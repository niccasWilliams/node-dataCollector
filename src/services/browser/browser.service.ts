import { chromium, Browser, BrowserContext, Page } from 'patchright';
import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import type {
  BrowserSession,
  BrowserConfig,
  NavigationOptions,
  ScreenshotOptions,
  PageInteraction,
  PageInfo,
  WaitForOptions,
  ElementQueryOptions,
  PageElement,
  LogoutOptions,
} from '../../types/browser.types';
import { SessionMonitor } from './session-monitor.service';
import { URLTracker } from './url-tracker.service';
import { HumanizedInteractionService } from './humanized-interaction.service';
import { CaptchaSolverService, type CaptchaParams } from './captcha-solver.service';
import { CookieConsentService } from './cookie-consent.service';

const ELEMENT_COLLECTOR_FN = new Function(
  'params',
  `
    const { tags, includeHidden = false, limit } = params || {};
    const tagFilter = Array.isArray(tags) && tags.length ? new Set(tags.map((tag) => String(tag).toLowerCase())) : null;
    const maxItems = typeof limit === 'number' && limit > 0 ? limit : null;

    const collected = [];
    const allElements = Array.from(document.querySelectorAll('*'));

    for (const node of allElements) {
      if (!(node instanceof HTMLElement)) continue;
      const htmlEl = node;
      const tagName = htmlEl.tagName.toLowerCase();

      if (tagFilter && !tagFilter.has(tagName)) {
        continue;
      }

      const style = window.getComputedStyle(htmlEl);
      const rect = htmlEl.getBoundingClientRect();
      const visible =
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        style.opacity !== '0';

      if (!includeHidden && !visible) {
        continue;
      }

      const attributes = {};
      for (const name of htmlEl.getAttributeNames()) {
        const value = htmlEl.getAttribute(name);
        if (value !== null) {
          attributes[name] = value;
        }
      }

      const textContent = (htmlEl.innerText || '').trim();

      const selectorParts = [];
      let current = htmlEl;
      let depth = 0;
      while (current && depth < 5) {
        if (current.id) {
          selectorParts.unshift('#' + current.id);
          current = null;
          break;
        }

        let selector = current.tagName.toLowerCase();
        const classList = Array.from(current.classList || []).slice(0, 2);
        if (classList.length) {
          selector += '.' + classList.join('.');
        }

        let siblingIndex = 1;
        let sibling = current.previousElementSibling;
        while (sibling) {
          if (sibling.tagName === current.tagName) {
            siblingIndex++;
          }
          sibling = sibling.previousElementSibling;
        }
        if (siblingIndex > 1) {
          selector += ':nth-of-type(' + siblingIndex + ')';
        }

        selectorParts.unshift(selector);
        current = current.parentElement;
        depth++;
      }

      const selectorPath = selectorParts.length ? selectorParts.join(' > ') : htmlEl.tagName.toLowerCase();
      const nameValue =
        typeof htmlEl.name === 'string' && htmlEl.name.length ? htmlEl.name : (attributes['name'] || undefined);
      const hrefValue = htmlEl instanceof HTMLAnchorElement ? htmlEl.href : (attributes['href'] || undefined);
      const typeValue = 'type' in htmlEl ? (htmlEl.type || attributes['type'] || undefined) : attributes['type'] || undefined;
      const formActionValue =
        htmlEl instanceof HTMLButtonElement
          ? htmlEl.formAction || htmlEl.getAttribute('formaction') || undefined
          : htmlEl.getAttribute('formaction') || undefined;
      const disabledValue = 'disabled' in htmlEl ? Boolean(htmlEl.disabled) : false;

      collected.push({
        tag: tagName,
        selector: selectorPath,
        text: textContent.length > 200 ? textContent.slice(0, 200) + '…' : textContent,
        attributes,
        classes: Array.from(htmlEl.classList),
        id: htmlEl.id || undefined,
        name: nameValue,
        href: hrefValue,
        type: typeValue,
        role: htmlEl.getAttribute('role'),
        formAction: formActionValue,
        visible,
        disabled: disabledValue,
        boundingBox: visible
          ? {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height,
            }
          : undefined,
      });

      if (maxItems && collected.length >= maxItems) {
        break;
      }
    }

    return collected;
  `
) as (params: { tags?: string[]; includeHidden?: boolean; limit?: number }) => Array<Record<string, any>>;

/**
 * BrowserService - Manages Playwright browser instances with real Chrome
 *
 * Features:
 * - Uses real Chrome installation (not Chromium)
 * - Session management with unique IDs
 * - Full navigation control
 * - Screenshot capabilities
 * - Page interaction (click, type, etc.)
 * - Cookie and localStorage management
 * - Event emission for monitoring
 */
export class BrowserService extends EventEmitter {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private session: BrowserSession | null = null;
  private config: BrowserConfig;

  // Neue Services für robustes Session-Management
  private sessionMonitor: SessionMonitor;
  private urlTracker: URLTracker;

  // Anti-Detection Services
  private humanizedInteraction: HumanizedInteractionService | null = null;
  private captchaSolver: CaptchaSolverService | null = null;
  private cookieConsentService: CookieConsentService | null = null;

  private static readonly DEFAULT_LOGOUT_KEYWORDS = [
    'logout',
    'log out',
    'sign out',
    'signout',
    'log off',
    'logoff',
    'sign off',
    'abmelden',
    'ausloggen',
    'abmeldung',
    'abmelde',
    'exit',
    'quit',
    'cerrar sesión',
    'déconnexion',
  ];

  constructor(config: Partial<BrowserConfig> = {}) {
    super();

    // Default configuration for real Chrome with Patchright
    // Patchright automatically adds the best anti-detection flags
    this.config = {
      headless: false, // Show browser for user visibility
      slowMo: 100, // Slow down by 100ms to appear more human-like
      devtools: false,
      args: [
        // Only essential Linux flags - Patchright handles the rest
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',

        // Locale
        '--lang=de-DE,de',
      ],
      viewport: {
        width: 1920,
        height: 1080,
      },
      navigation: {
        waitUntil: 'load',
        timeout: 45000,
      },
      ...config,
    };

    // Initialisiere Session Monitor & URL Tracker
    this.sessionMonitor = new SessionMonitor({
      healthCheckInterval: 5000,
      healthCheckTimeout: 3000,
      autoMarkClosedOnDisconnect: true,
    });

    this.urlTracker = new URLTracker();

    // Initialisiere Anti-Detection Services falls aktiviert
    if (config.humanizedInteractions !== false) {
      // Standard: aktiviert, außer explizit deaktiviert
      this.humanizedInteraction = new HumanizedInteractionService();
    }

    if (config.captchaSolver && config.captchaSolver.provider !== 'none' && config.captchaSolver.apiKey) {
      this.captchaSolver = new CaptchaSolverService({
        provider: config.captchaSolver.provider as 'none' extends typeof config.captchaSolver.provider ? never : typeof config.captchaSolver.provider,
        apiKey: config.captchaSolver.apiKey,
        timeout: config.captchaSolver.timeout,
      });
    }

    const cookieConsentConfig = this.config.cookieConsent ?? {};
    this.config.cookieConsent = cookieConsentConfig;
    if (cookieConsentConfig.autoReject !== false) {
      this.cookieConsentService = new CookieConsentService(cookieConsentConfig);
    }

    // Forward Events von Services
    this.setupServiceEventForwarding();
  }

  /**
   * Initialize browser session with Patchright (undetected Playwright)
   */
  async initialize(): Promise<BrowserSession> {
    if (this.browser) {
      throw new Error('Browser session already active');
    }

    try {
      // Launch real Chrome with Patchright for optimal stealth
      this.browser = await chromium.launch({
        headless: this.config.headless,
        channel: 'chrome', // Use system Chrome instead of executablePath
        args: this.config.args,
        slowMo: this.config.slowMo,
        devtools: this.config.devtools,
      });

      // Create context with minimal fingerprinting (let Chrome use real values)
      this.context = await this.browser.newContext({
        viewport: null, // Use real viewport from Chrome instead of fake dimensions
        // Don't set custom userAgent - let Chrome use its real one
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
        permissions: ['geolocation', 'notifications'],
        colorScheme: 'light',
        // Add realistic browser features
        hasTouch: false,
        isMobile: false,
        javaScriptEnabled: true,
        // IMPORTANT: Bypass CSP to allow scraping of external sites
        bypassCSP: true,
      });

      // Patchright handles most anti-detection internally via CDP patches
      // We only add minimal, safe enhancements that don't create detectable patterns
      await this.context.addInitScript(() => {
        // Add Chrome runtime objects for better stealth
        if (!(window as any).chrome) {
          Object.defineProperty(window, 'chrome', {
            writable: true,
            enumerable: true,
            configurable: false,
            value: {
              runtime: {},
              loadTimes: function () {},
              csi: function () {},
              app: {},
            },
          });
        }
      });

      // Create page
      this.page = await this.context.newPage();

      // Create session
      this.session = {
        id: this.generateSessionId(),
        status: 'idle',
        currentUrl: null,
        title: null,
        createdAt: new Date(),
        lastActivityAt: new Date(),
      };

      // Setup page event listeners
      this.setupPageListeners();

      // Starte Session Monitor & URL Tracker
      this.sessionMonitor.startMonitoring(
        this.session.id,
        this.browser,
        this.page,
        this.session
      );

      this.urlTracker.startTracking(
        this.session.id,
        this.page,
        this.session.currentUrl
      );

      this.emit('session:created', this.session);
      return this.session;
    } catch (error) {
      this.emit('error', error);
      throw new Error(`Failed to initialize browser: ${error}`);
    }
  }

  /**
   * Setup page event listeners for monitoring
   */
  private setupPageListeners(): void {
    if (!this.page) return;

    this.page.on('load', () => {
      this.updateSession({ status: 'idle' });
      this.emit('page:loaded', this.session);
    });

    this.page.on('domcontentloaded', () => {
      this.emit('page:domready', this.session);
    });

    this.page.on('console', (msg) => {
      this.emit('page:console', { type: msg.type(), text: msg.text() });
    });

    this.page.on('pageerror', (error) => {
      this.emit('page:error', error);
    });

    this.page.on('requestfailed', (request) => {
      this.emit('page:requestfailed', {
        url: request.url(),
        method: request.method(),
        failure: request.failure(),
      });
    });
  }

  /**
   * Synchronisiert Session mit aktuellem Browser-Status
   * WICHTIG: Wird vor jeder Aktion aufgerufen!
   */
  private async syncSession(): Promise<void> {
    if (!this.session || !this.page) return;

    try {
      // Prüfe ob Browser noch connected ist
      if (!this.browser?.isConnected()) {
        throw new Error(
          `Browser session ${this.session.id} is disconnected. Please create a new session.`
        );
      }

      // Hole aktuelle URL & Title vom Browser
      const currentUrl = this.page.url();
      const currentTitle = await this.page.title().catch(() => null);

      // Prüfe ob sich URL geändert hat (manuelle Navigation)
      if (currentUrl !== this.session.currentUrl) {
        console.log(
          `[BrowserService] Session ${this.session.id}: URL changed from ${this.session.currentUrl} to ${currentUrl}`
        );

        // Update Session
        this.updateSession({
          currentUrl,
          title: currentTitle,
        });

        // Registriere bei URLTracker falls noch nicht geschehen
        // (Falls manuelle Navigation, wird es vom URLTracker Event-Handler gecatcht)
      }

      // Update Title falls geändert
      if (currentTitle && currentTitle !== this.session.title) {
        this.updateSession({
          title: currentTitle,
        });
      }
    } catch (error) {
      console.error(`[BrowserService] Session sync failed:`, error);
      throw error;
    }
  }

  /**
   * Navigate to URL
   */
  async navigate(options: NavigationOptions): Promise<void> {
    this.ensureInitialized();
    await this.syncSession();

    try {
      this.updateSession({ status: 'navigating' });
      this.emit('navigation:start', options);

      const waitUntil = options.waitUntil || this.config.navigation?.waitUntil || 'networkidle';
      const timeout = options.timeout || this.config.navigation?.timeout || 30000;

      await this.page!.goto(options.url, {
        waitUntil,
        timeout,
      });

      // Wait for dynamic content (like cookie banners) to load
      await this.page!.waitForTimeout(1500);

      const cookieHandled = await this.handleCookieConsent().catch((error) => {
        logger.debug(`[BrowserService] Cookie consent handling error: ${String(error)}`);
        return false;
      });

      // If cookie banner was handled, wait for page to re-render
      if (cookieHandled) {
        await this.page!.waitForTimeout(800);
      }

      const title = await this.page!.title();
      this.updateSession({
        status: 'idle',
        currentUrl: options.url,
        title,
      });

      // Registriere programmatische Navigation beim URLTracker
      this.urlTracker.registerProgrammaticNavigation(
        this.session!.id,
        options.url,
        title
      );

      this.emit('navigation:complete', {
        url: options.url,
        title,
      });
    } catch (error) {
      this.updateSession({ status: 'idle' });
      this.emit('navigation:error', error);
      throw error;
    }
  }

  private async handleCookieConsent(): Promise<boolean> {
    if (!this.cookieConsentService || !this.page) {
      return false;
    }

    try {
      await this.performConsentWarmup();

      const cookieContainerSelectors = [
        '#sp-cc',
        '.sc-c62f2214-2',
        '#onetrust-banner-sdk',
        "[data-cookiebanner]",
        "[aria-label*='Cookie']",
        "[role='dialog']",
      ];

      const isBannerVisible = async (): Promise<boolean> => {
        return this.page!.evaluate((selectors) => {
          return selectors.some((selector: string) => {
            const element = document.querySelector<HTMLElement>(selector);
            if (!element) return false;
            const style = window.getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden') return false;
            const rect = element.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
          });
        }, cookieContainerSelectors);
      };

      const quickSelectors = [
        ...(this.config.cookieConsent?.selectors ?? []),
        // Amazon
        '#sp-cc-rejectall-link',
        '#sp-cc-reject-all-link',
        "button[data-action='sp-cc-rejectall']",
        "input[name='sp-cc-rejectall']",
        // Generic
        "button[data-testid='reject-all-button']",
        "[data-cookiebanner='reject_button']",
        '#onetrust-reject-all-handler',
        'button#onetrust-reject-all-handler',
        'button[aria-label="Ablehnen"]',
        'button[aria-label="Alle ablehnen"]',
      ];

      let handled = false;

      for (const selector of quickSelectors) {
        if (!selector) continue;
        const handle = await this.page.$(selector);
        if (!handle) {
          continue;
        }

        const visible = await handle.isVisible().catch(() => false);
        if (!visible) {
          await handle.dispose();
          continue;
        }

        let clicked = false;
        try {
          await this.interact({ type: 'click', selector });
          clicked = true;
        } catch (interactionError) {
          logger.debug(`[BrowserService] Quick cookie reject click failed (${selector}): ${String(interactionError)}`);
        }

        if (clicked) {
          const postClickDelay = this.config.cookieConsent?.postClickDelay ?? 900;
          if (postClickDelay > 0) {
            await this.page.waitForTimeout(postClickDelay);
          }

          const disappeared = !(await isBannerVisible());

          if (disappeared) {
            this.emit('cookie:rejected', {
              selector,
              label: 'quick-selector',
            });
            handled = true;
            await handle.dispose();
            break;
          }
        }

        await handle.dispose();
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = await this.cookieConsentService.findRejectCandidate(this.page);
        if (!candidate) {
          const stillVisible = await isBannerVisible();
          if (!stillVisible) {
            return handled;
          }
          await this.page.waitForTimeout(400);
          continue;
        }

        logger.debug(
          `[BrowserService] Rejecting cookies using selector "${candidate.selector}" (${candidate.label})`
        );

        await this.page.evaluate((selector) => {
          const target = document.querySelector<HTMLElement>(selector);
          if (target) {
            try {
              target.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } catch {
              target.scrollIntoView();
            }
          }
        }, candidate.selector);

        let clicked = false;
        try {
          await this.interact({ type: 'click', selector: candidate.selector });
          clicked = true;
        } catch (interactionError) {
          logger.debug(
            `[BrowserService] Humanized click failed for cookie banner (${candidate.selector}): ${String(
              interactionError
            )}`
          );
          await this.page.click(candidate.selector).then(() => {
            clicked = true;
          }).catch((fallbackError) => {
            logger.debug(
              `[BrowserService] Direct click fallback failed for cookie banner (${candidate.selector}): ${String(
                fallbackError
              )}`
            );
          });
        }

        if (!clicked) {
          continue;
        }

        const postClickDelay = this.config.cookieConsent?.postClickDelay ?? 900;
        if (postClickDelay > 0) {
          await this.page.waitForTimeout(postClickDelay);
        }

        const disappeared = !(await isBannerVisible());

        this.emit('cookie:rejected', {
          selector: candidate.selector,
          label: candidate.label,
        });

        if (disappeared) {
          return true;
        }

        handled = true;

        // Banner might have disappeared already, check first
        const stillVisibleAfterReject = await isBannerVisible();
        if (!stillVisibleAfterReject) {
          return true;
        }
      }

      return handled;
    } catch (error) {
      logger.debug(`[BrowserService] Cookie consent handling failed: ${String(error)}`);
      return false;
    }
  }

  private randomInt(min: number, max: number): number {
    const lower = Math.ceil(min);
    const upper = Math.floor(max);
    return Math.floor(Math.random() * (upper - lower + 1)) + lower;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
  }

  private async performConsentWarmup(): Promise<void> {
    if (!this.page) {
      return;
    }

    const enableWarmup = this.config.cookieConsent?.humanizedWarmup ?? true;
    if (!enableWarmup) {
      return;
    }

    const delayRange = this.config.cookieConsent?.warmupDelayRange ?? { min: 650, max: 1400 };
    const minDelay = Math.max(0, delayRange.min ?? 350);
    const maxDelay = Math.max(minDelay, delayRange.max ?? 900);
    await this.page.waitForTimeout(this.randomInt(minDelay, maxDelay));

    const viewport = this.page.viewportSize() ?? { width: 1280, height: 720 };
    const target = {
      x: this.randomInt(Math.floor(viewport.width * 0.2), Math.floor(viewport.width * 0.8)),
      y: this.randomInt(Math.floor(viewport.height * 0.2), Math.floor(viewport.height * 0.8)),
    };

    try {
      if (this.humanizedInteraction) {
        await this.humanizedInteraction.moveMouseTo(this.page, target);
        if (Math.random() < 0.45) {
          const offsetTarget = {
            x: this.clamp(target.x + this.randomInt(-80, 80), 10, viewport.width - 10),
            y: this.clamp(target.y + this.randomInt(-60, 60), 10, viewport.height - 10),
          };
          await this.page.waitForTimeout(this.randomInt(120, 320));
          await this.humanizedInteraction.moveMouseTo(this.page, offsetTarget);
        }
      } else {
        await this.page.mouse.move(target.x, target.y, { steps: this.randomInt(6, 14) });
      }
    } catch (error) {
      logger.debug(`[BrowserService] Warmup mouse movement failed: ${String(error)}`);
    }

    const scrollRange = this.config.cookieConsent?.warmupScrollRange ?? { min: 160, max: 420 };
    const scrollDistance = this.randomInt(scrollRange.min ?? 120, scrollRange.max ?? 360);

    try {
      await this.page.evaluate((distance) => {
        try {
          window.scrollBy({ top: distance, left: 0, behavior: 'smooth' });
        } catch {
          window.scrollBy(distance, 0);
        }
      }, scrollDistance);
      await this.page.waitForTimeout(this.randomInt(180, 420));
    } catch (error) {
      logger.debug(`[BrowserService] Warmup scroll failed: ${String(error)}`);
    }
  }

  /**
   * Take screenshot
   */
  async screenshot(options: ScreenshotOptions = {}): Promise<Buffer> {
    this.ensureInitialized();
    await this.syncSession();

    try {
      const screenshot = await this.page!.screenshot({
        fullPage: options.fullPage ?? false,
        type: options.type || 'png',
        quality: options.quality,
        path: options.path,
      });

      this.emit('screenshot:taken', {
        size: screenshot.length,
        options,
      });

      return screenshot;
    } catch (error) {
      this.emit('screenshot:error', error);
      throw error;
    }
  }

  /**
   * Interact with page elements
   * Automatically uses humanized interactions if enabled in config
   */
  async interact(interaction: PageInteraction): Promise<void> {
    this.ensureInitialized();
    await this.syncSession();

    try {
      const { type, selector, value, options } = interaction;

      // Use humanized interactions if enabled
      const useHumanized = this.config.humanizedInteractions !== false && this.humanizedInteraction;

      switch (type) {
        case 'click':
          if (!selector) throw new Error('Selector required for click');
          if (useHumanized) {
            await this.humanizedInteraction!.clickElement(this.page!, selector, options);
          } else {
            await this.page!.click(selector, options);
          }
          break;

        case 'type':
          if (!selector || !value) throw new Error('Selector and value required for type');
          if (useHumanized) {
            await this.humanizedInteraction!.typeText(this.page!, value, selector);
          } else {
            await this.page!.fill(selector, value);
          }
          break;

        case 'select':
          if (!selector || !value) throw new Error('Selector and value required for select');
          await this.page!.selectOption(selector, value);
          break;

        case 'hover':
          if (!selector) throw new Error('Selector required for hover');
          await this.page!.hover(selector);
          break;

        case 'scroll':
          if (useHumanized) {
            const y = options?.y || 0;
            const direction = y < 0 ? 'up' : 'down';
            const amount = Math.abs(y);
            await this.humanizedInteraction!.scroll(this.page!, { direction, amount });
          } else {
            await this.page!.evaluate(
              ({ x, y }) => window.scrollTo(x || 0, y || 0),
              options || {}
            );
          }
          break;

        default:
          throw new Error(`Unknown interaction type: ${type}`);
      }

      this.updateSession({ status: 'idle' });
      this.emit('interaction:complete', { ...interaction, humanized: useHumanized });
    } catch (error) {
      this.emit('interaction:error', { interaction, error });
      throw error;
    }
  }

  /**
   * Wait for element or condition
   */
  async waitFor(options: WaitForOptions): Promise<void> {
    this.ensureInitialized();

    if (options.selector) {
      await this.page!.waitForSelector(options.selector, {
        timeout: options.timeout || 30000,
        state: options.state || 'visible',
      });
    }
  }

  /**
   * Execute custom JavaScript
   */
  async evaluate<T>(script: string | Function, ...args: any[]): Promise<T> {
    this.ensureInitialized();
    return await this.page!.evaluate(script as any, ...args);
  }

  /**
   * Get page information
   */
  async getPageInfo(): Promise<PageInfo> {
    this.ensureInitialized();

    const url = this.page!.url();
    const title = await this.page!.title();
    const cookies = await this.context!.cookies();

    let localStorage: Record<string, string> | undefined;
    try {
      localStorage = await this.page!.evaluate(() => {
        const items: Record<string, string> = {};
        for (let i = 0; i < window.localStorage.length; i++) {
          const key = window.localStorage.key(i);
          if (key) {
            items[key] = window.localStorage.getItem(key) || '';
          }
        }
        return items;
      });
    } catch (error) {
      this.emit('page:localstorage:error', error);
    }

    return {
      url,
      title,
      cookies,
      localStorage,
    };
  }

  /**
   * Get page HTML
   */
  async getHTML(): Promise<string> {
    this.ensureInitialized();
    return await this.page!.content();
  }

  /**
   * Collect elements on the current page with metadata for inspection.
   */
  async getElements(options: ElementQueryOptions = {}): Promise<PageElement[]> {
    this.ensureInitialized();

    const { tags, includeHidden = false, limit } = options;

    const elements = await this.page!.evaluate(
      ELEMENT_COLLECTOR_FN,
      {
        tags,
        includeHidden,
        limit,
      }
    );

    return elements as PageElement[];
  }

  /**
   * Set cookies
   */
  async setCookies(cookies: Array<any>): Promise<void> {
    this.ensureInitialized();
    await this.context!.addCookies(cookies);
  }

  /**
   * Clear cookies
   */
  async clearCookies(): Promise<void> {
    this.ensureInitialized();
    await this.context!.clearCookies();
  }

  /**
   * Attempt to logout from the current application by clicking common logout controls.
   */
  async logout(options: LogoutOptions = {}): Promise<boolean> {
    this.ensureInitialized();

    const page = this.page!;
    const explicitSelectors = options.selectors ?? [];
    const keywords =
      options.keywords && options.keywords.length
        ? options.keywords
        : BrowserService.DEFAULT_LOGOUT_KEYWORDS;
    const waitForNavigation = options.waitForNavigation ?? true;
    const timeout = options.timeout ?? 5000;

    const attemptedSelectors: string[] = [];

    // Try user-provided selectors first
    for (const selector of explicitSelectors) {
      try {
        await this.clickSelectorWithOptionalWait(selector, waitForNavigation, timeout);
        attemptedSelectors.push(selector);
        this.emit('session:logout', { selector, strategy: 'explicit' });
        this.updateSession({ status: 'idle' });
        return true;
      } catch (error) {
        attemptedSelectors.push(selector);
        this.emit('interaction:error', { interaction: { type: 'click', selector }, error });
      }
    }

    // Heuristic search for logout candidates
    const autoSelectors = await page.evaluate(
      ({ keywords }) => {
        const normalized = keywords.map((k: string) => k.toLowerCase());
        const getCssPath = (element: Element | null): string => {
          if (!element) return '';
          const path: string[] = [];
          let current: Element | null = element;
          let depth = 0;

          while (current && depth < 5) {
            if ((current as HTMLElement).id) {
              path.unshift(`#${(current as HTMLElement).id}`);
              break;
            }

            const tagName = current.tagName.toLowerCase();
            let selector = tagName;

            const classList = Array.from((current as HTMLElement).classList || []).slice(0, 2);
            if (classList.length) {
              selector += `.${classList.join('.')}`;
            }

            let siblingIndex = 1;
            let sibling = current.previousElementSibling;
            while (sibling) {
              if (sibling.tagName === current.tagName) {
                siblingIndex++;
              }
              sibling = sibling.previousElementSibling;
            }
            if (siblingIndex > 1) {
              selector += `:nth-of-type(${siblingIndex})`;
            }

            path.unshift(selector);
            current = current.parentElement;
            depth++;
          }

          return path.join(' > ') || element.tagName.toLowerCase();
        };

        const seen = new Set<string>();
        const matches: string[] = [];
        const candidates = new Set<Element>();
        const selectors = [
          'button',
          'a',
          '[role="button"]',
          'input[type="button"]',
          'input[type="submit"]',
          '[data-action]',
          '[data-testid]',
          '[href]',
        ];

        selectors.forEach((selector) => {
          document.querySelectorAll(selector).forEach((el) => candidates.add(el));
        });

        candidates.forEach((el) => {
          if (!(el instanceof HTMLElement)) return;

          const text = (el.innerText || '').toLowerCase();
          const attrValues = el.getAttributeNames().map((name) => (el.getAttribute(name) || '').toLowerCase());
          const datasetValues = Object.values(el.dataset || {}).map((value) => (value || '').toLowerCase());
          const href = (el.getAttribute('href') || '').toLowerCase();
          const valueAttribute = (el.getAttribute('value') || '').toLowerCase();
          const aggregated = [text, href, valueAttribute, ...attrValues, ...datasetValues].filter(Boolean);

          const hit = normalized.find((keyword) => aggregated.some((value) => value.includes(keyword)));
          if (hit) {
            const selector = getCssPath(el);
            if (selector && !seen.has(selector)) {
              seen.add(selector);
              matches.push(selector);
            }
          }
        });

        return matches.slice(0, 10);
      },
      { keywords }
    );

    for (const selector of autoSelectors) {
      try {
        await this.clickSelectorWithOptionalWait(selector, waitForNavigation, timeout);
        attemptedSelectors.push(selector);
        this.emit('session:logout', { selector, strategy: 'auto' });
        this.updateSession({ status: 'idle' });
        return true;
      } catch (error) {
        attemptedSelectors.push(selector);
        this.emit('interaction:error', { interaction: { type: 'click', selector }, error });
      }
    }

    this.emit('session:logout:failed', {
      keywords,
      attemptedSelectors,
    });

    return false;
  }

  /**
   * Go back in history
   */
  async goBack(): Promise<void> {
    this.ensureInitialized();
    await this.page!.goBack();
    this.updateSession({
      currentUrl: this.page!.url(),
      title: await this.page!.title(),
    });
  }

  /**
   * Go forward in history
   */
  async goForward(): Promise<void> {
    this.ensureInitialized();
    await this.page!.goForward();
    this.updateSession({
      currentUrl: this.page!.url(),
      title: await this.page!.title(),
    });
  }

  /**
   * Reload page
   */
  async reload(): Promise<void> {
    this.ensureInitialized();
    await this.page!.reload();
  }

  /**
   * Get current session
   */
  getSession(): BrowserSession | null {
    return this.session;
  }

  /**
   * Click element with humanized mouse movement
   */
  async clickHumanized(selector: string, options: { button?: 'left' | 'right' | 'middle'; clickCount?: number } = {}): Promise<void> {
    this.ensureInitialized();
    await this.syncSession();

    if (!this.humanizedInteraction) {
      throw new Error('Humanized interactions are disabled. Enable them in BrowserConfig.');
    }

    try {
      await this.humanizedInteraction.clickElement(this.page!, selector, options);
      this.updateSession({ status: 'idle' });
      this.emit('interaction:complete', { type: 'click', selector, humanized: true });
    } catch (error) {
      this.emit('interaction:error', { interaction: { type: 'click', selector }, error });
      throw error;
    }
  }

  /**
   * Type text with humanized timing and occasional typos
   */
  async typeHumanized(text: string, selector?: string): Promise<void> {
    this.ensureInitialized();
    await this.syncSession();

    if (!this.humanizedInteraction) {
      throw new Error('Humanized interactions are disabled. Enable them in BrowserConfig.');
    }

    try {
      await this.humanizedInteraction.typeText(this.page!, text, selector);
      this.updateSession({ status: 'idle' });
      this.emit('interaction:complete', { type: 'type', selector, humanized: true });
    } catch (error) {
      this.emit('interaction:error', { interaction: { type: 'type', selector }, error });
      throw error;
    }
  }

  /**
   * Scroll page with humanized behavior
   */
  async scrollHumanized(options: { direction?: 'up' | 'down'; amount?: number; smooth?: boolean } = {}): Promise<void> {
    this.ensureInitialized();
    await this.syncSession();

    if (!this.humanizedInteraction) {
      throw new Error('Humanized interactions are disabled. Enable them in BrowserConfig.');
    }

    try {
      await this.humanizedInteraction.scroll(this.page!, options);
      this.updateSession({ status: 'idle' });
      this.emit('interaction:complete', { type: 'scroll', humanized: true });
    } catch (error) {
      this.emit('interaction:error', { interaction: { type: 'scroll' }, error });
      throw error;
    }
  }

  /**
   * Simulate human reading behavior (random mouse movements and scrolling)
   */
  async simulateReading(duration?: number): Promise<void> {
    this.ensureInitialized();
    await this.syncSession();

    if (!this.humanizedInteraction) {
      throw new Error('Humanized interactions are disabled. Enable them in BrowserConfig.');
    }

    try {
      await this.humanizedInteraction.simulateReading(this.page!, duration);
      this.updateSession({ status: 'idle' });
      this.emit('interaction:complete', { type: 'reading', humanized: true });
    } catch (error) {
      this.emit('interaction:error', { interaction: { type: 'reading' }, error });
      throw error;
    }
  }

  /**
   * Solve CAPTCHA manually with specific parameters
   */
  async solveCaptcha(params: CaptchaParams): Promise<string> {
    this.ensureInitialized();
    await this.syncSession();

    if (!this.captchaSolver) {
      throw new Error('CAPTCHA solver is not configured. Add captchaSolver configuration to BrowserConfig.');
    }

    try {
      const solution = await this.captchaSolver.solve(params);
      this.emit('captcha:solved', { type: params.type, taskId: solution.taskId, solveTime: solution.solveTime });
      return solution.solution;
    } catch (error) {
      this.emit('captcha:error', { type: params.type, error });
      throw error;
    }
  }

  /**
   * Auto-detect and solve reCAPTCHA v2 on current page
   */
  async solveRecaptchaV2(): Promise<string | null> {
    this.ensureInitialized();
    await this.syncSession();

    if (!this.captchaSolver) {
      throw new Error('CAPTCHA solver is not configured. Add captchaSolver configuration to BrowserConfig.');
    }

    try {
      const solution = await this.captchaSolver.solveRecaptchaV2OnPage(this.page!);
      if (solution) {
        this.emit('captcha:solved', { type: 'recaptcha_v2', auto: true });
      }
      return solution;
    } catch (error) {
      this.emit('captcha:error', { type: 'recaptcha_v2', error });
      throw error;
    }
  }

  /**
   * Auto-detect and solve hCaptcha on current page
   */
  async solveHCaptcha(): Promise<string | null> {
    this.ensureInitialized();
    await this.syncSession();

    if (!this.captchaSolver) {
      throw new Error('CAPTCHA solver is not configured. Add captchaSolver configuration to BrowserConfig.');
    }

    try {
      const solution = await this.captchaSolver.solveHCaptchaOnPage(this.page!);
      if (solution) {
        this.emit('captcha:solved', { type: 'hcaptcha', auto: true });
      }
      return solution;
    } catch (error) {
      this.emit('captcha:error', { type: 'hcaptcha', error });
      throw error;
    }
  }

  /**
   * Auto-detect and solve any CAPTCHA on current page
   * Tries all supported CAPTCHA types in order
   */
  async solveAnyCaptcha(): Promise<{ type: string; solution: string } | null> {
    this.ensureInitialized();
    await this.syncSession();

    if (!this.captchaSolver) {
      throw new Error('CAPTCHA solver is not configured. Add captchaSolver configuration to BrowserConfig.');
    }

    // Detect CAPTCHA type by checking for specific elements/iframes
    const captchaInfo = await this.page!.evaluate(() => {
      const results: { type: string; found: boolean; sitekey?: string }[] = [];

      // Check for reCAPTCHA v2
      const recaptchaV2Frame = Array.from(document.querySelectorAll('iframe')).find(
        (frame) => frame.src.includes('google.com/recaptcha/api2/anchor')
      );
      if (recaptchaV2Frame) {
        const url = new URL(recaptchaV2Frame.src);
        const sitekey = url.searchParams.get('k');
        results.push({ type: 'recaptcha_v2', found: true, sitekey: sitekey || undefined });
      }

      // Check for reCAPTCHA v3 (harder to detect, look for grecaptcha object)
      if ((window as any).grecaptcha) {
        results.push({ type: 'recaptcha_v3', found: true });
      }

      // Check for hCaptcha
      const hcaptchaFrame = Array.from(document.querySelectorAll('iframe')).find(
        (frame) => frame.src.includes('hcaptcha.com/captcha')
      );
      if (hcaptchaFrame) {
        const container = document.querySelector('[data-sitekey]') as HTMLElement | null;
        const sitekey = container?.getAttribute('data-sitekey');
        results.push({ type: 'hcaptcha', found: true, sitekey: sitekey || undefined });
      }

      // Check for FunCaptcha
      const funcaptcha = document.querySelector('[data-public-key]') as HTMLElement | null;
      if (funcaptcha) {
        results.push({ type: 'funcaptcha', found: true });
      }

      // Check for GeeTest
      if ((window as any).initGeetest) {
        results.push({ type: 'geetest', found: true });
      }

      return results.filter((r) => r.found);
    });

    if (captchaInfo.length === 0) {
      this.emit('captcha:notfound');
      return null;
    }

    // Try to solve the first detected CAPTCHA
    for (const info of captchaInfo) {
      try {
        let solution: string | null = null;

        switch (info.type) {
          case 'recaptcha_v2':
            this.emit('captcha:detected', { type: 'recaptcha_v2', sitekey: info.sitekey });
            solution = await this.solveRecaptchaV2();
            break;

          case 'hcaptcha':
            this.emit('captcha:detected', { type: 'hcaptcha', sitekey: info.sitekey });
            solution = await this.solveHCaptcha();
            break;

          case 'recaptcha_v3':
            this.emit('captcha:detected', { type: 'recaptcha_v3' });
            // reCAPTCHA v3 is harder to auto-solve, requires action parameter
            this.emit('captcha:warning', {
              type: 'recaptcha_v3',
              message: 'reCAPTCHA v3 detected but requires manual configuration (action parameter)',
            });
            break;

          default:
            this.emit('captcha:warning', {
              type: info.type,
              message: `${info.type} detected but auto-solving not yet implemented`,
            });
        }

        if (solution) {
          return { type: info.type, solution };
        }
      } catch (error) {
        this.emit('captcha:error', { type: info.type, error });
        // Continue to next CAPTCHA type
      }
    }

    return null;
  }

  /**
   * Close browser session
   */
  async close(): Promise<void> {
    if (!this.browser) return;

    try {
      const sessionId = this.session?.id;

      // Stoppe Monitoring & Tracking
      if (sessionId) {
        this.sessionMonitor.stopMonitoring(sessionId);
        this.urlTracker.stopTracking(sessionId);
      }

      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;

      if (this.session) {
        this.updateSession({ status: 'closed' });
        this.emit('session:closed', {
          session: this.session,
          reason: 'manual',
        });
      }

      this.session = null;
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Check if browser is initialized
   */
  isInitialized(): boolean {
    return this.browser !== null && this.page !== null;
  }

  /**
   * Setup Event Forwarding von Services
   */
  private setupServiceEventForwarding(): void {
    // Forward SessionMonitor Events
    this.sessionMonitor.on('browser:disconnected', (event) => {
      this.emit('browser:disconnected', event);

      // Update Session Status
      if (this.session && event.sessionId === this.session.id) {
        this.updateSession({ status: 'closed' });
      }
    });

    this.sessionMonitor.on('browser:health', (event) => {
      this.emit('browser:health', event);
    });

    this.sessionMonitor.on('session:closed', (event) => {
      this.emit('session:closed', event);
    });

    // Forward URLTracker Events
    this.urlTracker.on('url:changed', (event) => {
      this.emit('url:changed', event);

      // Auto-Update Session bei URL-Änderungen
      if (this.session && event.sessionId === this.session.id) {
        this.updateSession({
          currentUrl: event.currentUrl,
          title: event.title,
        });

        // Emit auch session:updated Event
        this.emit('session:updated', {
          session: this.session,
          changes: {
            currentUrl: event.currentUrl,
            title: event.title,
          },
        });
      }
    });
  }

  // Private helper methods

  private ensureInitialized(): void {
    if (!this.browser || !this.page) {
      throw new Error('Browser not initialized. Call initialize() first.');
    }
  }

  private updateSession(updates: Partial<BrowserSession>): void {
    if (!this.session) return;

    this.session = {
      ...this.session,
      ...updates,
      lastActivityAt: new Date(),
    };
  }

  private generateSessionId(): string {
    return `browser-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  private async clickSelectorWithOptionalWait(
    selector: string,
    waitForNavigation: boolean,
    timeout: number
  ): Promise<void> {
    await this.page!.waitForSelector(selector, {
      timeout,
      state: 'visible',
    });

    if (waitForNavigation) {
      await Promise.all([
        this.page!
          .waitForLoadState('networkidle', { timeout })
          .catch(() => this.page!.waitForTimeout(500)),
        this.page!.click(selector, { timeout }),
      ]);
    } else {
      await this.page!.click(selector, { timeout });
    }
  }
}
