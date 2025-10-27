import { chromium, Browser, BrowserContext, Page } from 'patchright';
import { EventEmitter } from 'events';
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
      ...config,
    };
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
      });

      // Patchright handles most anti-detection internally via CDP patches
      // We only add minimal, safe enhancements that don't create detectable patterns
      await this.context.addInitScript(() => {
        // Add chrome object (real Chrome has this)
        if (!(window as any).chrome) {
          (window as any).chrome = {
            runtime: {},
            loadTimes: function() {},
            csi: function() {},
            app: {}
          };
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
   * Navigate to URL
   */
  async navigate(options: NavigationOptions): Promise<void> {
    this.ensureInitialized();

    try {
      this.updateSession({ status: 'navigating' });
      this.emit('navigation:start', options);

      await this.page!.goto(options.url, {
        waitUntil: options.waitUntil || 'networkidle',
        timeout: options.timeout || 30000,
      });

      const title = await this.page!.title();
      this.updateSession({
        status: 'idle',
        currentUrl: options.url,
        title,
      });

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

  /**
   * Take screenshot
   */
  async screenshot(options: ScreenshotOptions = {}): Promise<Buffer> {
    this.ensureInitialized();

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
   */
  async interact(interaction: PageInteraction): Promise<void> {
    this.ensureInitialized();

    try {
      const { type, selector, value, options } = interaction;

      switch (type) {
        case 'click':
          if (!selector) throw new Error('Selector required for click');
          await this.page!.click(selector, options);
          break;

        case 'type':
          if (!selector || !value) throw new Error('Selector and value required for type');
          await this.page!.fill(selector, value);
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
          await this.page!.evaluate(
            ({ x, y }) => window.scrollTo(x || 0, y || 0),
            options || {}
          );
          break;

        default:
          throw new Error(`Unknown interaction type: ${type}`);
      }

      this.updateSession({ status: 'idle' });
      this.emit('interaction:complete', interaction);
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
   * Close browser session
   */
  async close(): Promise<void> {
    if (!this.browser) return;

    try {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;

      if (this.session) {
        this.updateSession({ status: 'closed' });
        this.emit('session:closed', this.session);
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
    return `browser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
