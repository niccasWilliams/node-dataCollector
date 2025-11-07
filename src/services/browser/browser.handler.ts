import { BrowserService } from './browser.service';
import { browserStealthService, type StealthSession } from './browser-stealth.service';
import { botDetectionService, type BotDetectionResult } from './bot-detection.service';
import { userDataService } from './user-data.service';
import { upsertBrowserSession, recordBrowserActivity } from './browser.repository';
import type {
  BrowserSession,
  NavigationOptions,
  ScreenshotOptions,
  BrowserConfig,
  PageInfo,
  ElementQueryOptions,
  PageElement,
  LogoutOptions,
} from '../../types/browser.types';
import type { BrowserActivityType } from '@/db/individual/individual-schema';
import { storeWebsiteSnapshot, type PageSnapshot, INTERACTIVE_TAGS } from '../../routes/websites/website.repository';
import path from 'path';
import { logger } from '@/utils/logger';

/**
 * BrowserHandler - High-level API for browser automation
 *
 * NOW USES STEALTH BROWSER BY DEFAULT! 🔒
 * All sessions are created with maximum anti-detection.
 */
export class BrowserHandler {
  private instances: Map<string, BrowserService> = new Map();
  private stealthSessions: Map<string, StealthSession> = new Map();
  private defaultConfig: Partial<BrowserConfig>;
  private sessionConfigs: Map<string, Partial<BrowserConfig>> = new Map();
  private useStealth: boolean = true; // NEW: Default to stealth!

  constructor(defaultConfig: Partial<BrowserConfig> = {}) {
    this.defaultConfig = defaultConfig;
    // Default to stealth mode (can be disabled with useStealth: false)
    this.useStealth = defaultConfig.useStealth !== false;
  }

  /**
   * Create a new browser session - NOW WITH STEALTH BY DEFAULT! 🔒
   */
  async createSession(config?: Partial<BrowserConfig>): Promise<BrowserSession> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const sanitizedConfig = JSON.parse(JSON.stringify(mergedConfig ?? {})) as Partial<BrowserConfig>;

    // Determine if we should use stealth (default: YES!)
    const shouldUseStealth = mergedConfig.useStealth !== false && this.useStealth;

    if (shouldUseStealth) {
      logger.info('[BrowserHandler] 🔒 Creating STEALTH session (default)');
      return await this.createStealthSession(sanitizedConfig);
    } else {
      // Legacy mode (deprecated!)
      logger.warn('[BrowserHandler] ⚠️ Creating LEGACY session (not recommended!)');
      return await this.createLegacySession(sanitizedConfig);
    }
  }

  /**
   * Create STEALTH session (NEW DEFAULT!)
   */
  private async createStealthSession(config: Partial<BrowserConfig>): Promise<BrowserSession> {
    // Extensions: Always use dummy extension for maximum authenticity!
    // Real users have extensions, bots don't!
    const extensionsPath = config.extensions || [
      path.resolve(__dirname, '../../../extensions/dummy-extension'),
    ];

    // Handle persistent profile
    let userDataDir: string | undefined;
    let fingerprintSeed: number | undefined;
    if (config.persistProfile) {
      if (typeof config.persistProfile === 'string') {
        // Use specific profile name
        const profile = await userDataService.getOrCreateProfile(config.persistProfile);
        userDataDir = profile.path;
        fingerprintSeed = profile.fingerprintSeed;
        logger.info(`[BrowserHandler] 🔐 Using persistent profile: ${profile.name}`);
      } else {
        // Auto-create profile based on first URL (will be set later)
        // For now, create a generic profile
        const profile = await userDataService.getOrCreateProfile('default-profile');
        userDataDir = profile.path;
        fingerprintSeed = profile.fingerprintSeed;
        logger.info(`[BrowserHandler] 🔐 Using persistent profile: ${profile.name} (auto-created)`);
      }
    }

    try {
      // Create stealth session with SENSIBLE DEFAULTS
      const stealthSession = await browserStealthService.createStealthSession({
        headless: config.headless ?? false, // Default: visible
        slowMo: config.slowMo ?? 100, // Default: humanized (100ms)
        extensions: extensionsPath, // Always use extensions for authenticity
        userDataDir, // Use persistent profile if configured
        fingerprintSeed, // Keep fingerprint consistent with profile
      });

      // Store session
      this.stealthSessions.set(stealthSession.id, stealthSession);
      this.sessionConfigs.set(stealthSession.id, config);

      // Convert to BrowserSession for compatibility
      const session: BrowserSession = {
        id: stealthSession.id,
        status: stealthSession.status,
        currentUrl: stealthSession.currentUrl,
        title: stealthSession.title,
        createdAt: stealthSession.createdAt,
        lastActivityAt: stealthSession.lastActivityAt,
        closedAt: stealthSession.closedAt,
      };

      await this.persistSessionData(session, { config });

      return session;
    } catch (error) {
      // Fallback: If Chromium not installed, use Legacy with warning
      logger.warn('[BrowserHandler] ⚠️ Stealth mode failed (Chromium not installed?), falling back to Legacy mode');
      logger.warn('[BrowserHandler] 💡 Install Chromium: npx patchright install chromium');
      logger.warn('[BrowserHandler] ⚠️ Using Legacy browser WITHOUT extensions and anti-detection!');

      // Fall back to legacy
      return await this.createLegacySession(config);
    }
  }

  /**
   * Create LEGACY session (DEPRECATED!)
   */
  private async createLegacySession(config: Partial<BrowserConfig>): Promise<BrowserSession> {
    const service = new BrowserService(config);

    // Setup event forwarding
    this.setupEventForwarding(service);

    const session = await service.initialize();
    this.instances.set(session.id, service);
    this.sessionConfigs.set(session.id, config);

    await this.persistSessionData(session, { config });

    return session;
  }

  /**
   * Get browser service by session ID (supports both Stealth and Legacy!)
   */
  private getService(sessionId: string): BrowserService {
    // Try stealth first
    const stealthSession = this.stealthSessions.get(sessionId);
    if (stealthSession) {
      // Return a compatibility wrapper for stealth sessions
      return this.createStealthServiceWrapper(stealthSession);
    }

    // Fall back to legacy
    const service = this.instances.get(sessionId);
    if (!service) {
      throw new Error(`Browser session not found: ${sessionId}`);
    }
    return service;
  }

  /**
   * Create a wrapper that makes Stealth session look like BrowserService
   */
  private createStealthServiceWrapper(stealthSession: StealthSession): any {
    const { page } = stealthSession;

    // Return an object that mimics BrowserService API
    return {
      navigate: async (options: NavigationOptions) => {
        await page.goto(options.url, {
          waitUntil: options.waitUntil || 'domcontentloaded',
          timeout: options.timeout || 30000,
        });
        // Update session
        stealthSession.currentUrl = page.url();
        stealthSession.title = await page.title();
        stealthSession.lastActivityAt = new Date();
      },
      screenshot: async (options?: ScreenshotOptions) => {
        return await page.screenshot({
          fullPage: options?.fullPage ?? false,
          type: options?.type || 'png',
          quality: options?.quality,
          path: options?.path,
        });
      },
      interact: async (interaction: any) => {
        const { type, selector, value, options } = interaction;
        switch (type) {
          case 'click':
            await page.click(selector!, options);
            break;
          case 'type':
            await page.fill(selector!, value!);
            break;
          case 'select':
            await page.selectOption(selector!, value!);
            break;
          case 'hover':
            await page.hover(selector!);
            break;
          case 'scroll':
            await page.evaluate(({ x, y }) => window.scrollTo(x || 0, y || 0), options || {});
            break;
        }
        stealthSession.lastActivityAt = new Date();
      },
      waitFor: async (options: any) => {
        if (options.selector) {
          await page.waitForSelector(options.selector, {
            timeout: options.timeout || 30000,
            state: options.state || 'visible',
          });
        }
      },
      evaluate: async <T>(script: string | Function, ...args: any[]): Promise<T> => {
        return await page.evaluate(script as any, ...args);
      },
      getPageInfo: async (): Promise<PageInfo> => {
        const url = page.url();
        const title = await page.title();
        const cookies = await stealthSession.context.cookies();
        const localStorage = await page.evaluate(() => {
          const items: Record<string, string> = {};
          for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (key) {
              items[key] = window.localStorage.getItem(key) || '';
            }
          }
          return items;
        });
        return { url, title, cookies, localStorage };
      },
      getHTML: async (): Promise<string> => {
        return await page.content();
      },
      getElements: async (options: ElementQueryOptions): Promise<PageElement[]> => {
        // TODO: Implement element collection for stealth
        return [];
      },
      logout: async (options?: LogoutOptions): Promise<boolean> => {
        // TODO: Implement logout for stealth
        return false;
      },
      goBack: async () => {
        await page.goBack();
        stealthSession.currentUrl = page.url();
        stealthSession.title = await page.title();
      },
      goForward: async () => {
        await page.goForward();
        stealthSession.currentUrl = page.url();
        stealthSession.title = await page.title();
      },
      reload: async () => {
        await page.reload();
      },
      getSession: () => ({
        id: stealthSession.id,
        status: stealthSession.status,
        currentUrl: stealthSession.currentUrl,
        title: stealthSession.title,
        createdAt: stealthSession.createdAt,
        lastActivityAt: stealthSession.lastActivityAt,
      }),
      close: async () => {
        await browserStealthService.closeSession(stealthSession.id);
        stealthSession.status = 'closed';
        stealthSession.closedAt = new Date();
      },
      // Humanized methods
      clickHumanized: async (selector: string, options?: any) => {
        await page.click(selector, options);
        stealthSession.lastActivityAt = new Date();
      },
      typeHumanized: async (text: string, selector?: string) => {
        if (selector) {
          await page.fill(selector, text);
        }
        stealthSession.lastActivityAt = new Date();
      },
      scrollHumanized: async (options?: any) => {
        const direction = options?.direction || 'down';
        const amount = options?.amount || 500;
        const y = direction === 'down' ? amount : -amount;
        await page.evaluate((scrollY) => window.scrollBy(0, scrollY), y);
      },
      simulateReading: async (duration?: number) => {
        await page.waitForTimeout(duration || 3000);
      },
      solveAnyCaptcha: async () => null,
      solveRecaptchaV2: async () => null,
      solveHCaptcha: async () => null,
    };
  }

  /**
   * Navigate to URL
   */
  async navigate(sessionId: string, url: string, options?: Partial<NavigationOptions>): Promise<void> {
    const service = this.getService(sessionId);
    const config = this.sessionConfigs.get(sessionId);

    await service.navigate({ url, ...options });

    // Bot-Detection Check (if enabled)
    const shouldCheckBotDetection = config?.botDetection !== false; // Default: true
    if (shouldCheckBotDetection) {
      const stealthSession = this.stealthSessions.get(sessionId);
      if (stealthSession) {
        const { page } = stealthSession;

        // Check for bot detection
        const botCheck = await botDetectionService.checkPage(page);

        if (botCheck.detected) {
          const action = config?.onBotDetected || 'warn';

          if (action === 'stop') {
            logger.error('[BrowserHandler] 🚨 BOT DETECTED! Stopping session.', {
              confidence: botCheck.confidence,
              indicators: botCheck.indicators.length,
              url: botCheck.url,
            });

            // Close session immediately
            await this.closeSession(sessionId);
            throw new Error(`Bot detected with ${botCheck.confidence}% confidence. Session stopped for safety.`);
          } else if (action === 'warn') {
            logger.warn('[BrowserHandler] ⚠️ BOT DETECTION WARNING', {
              confidence: botCheck.confidence,
              indicators: botCheck.indicators.map(i => i.type).join(', '),
              url: botCheck.url,
            });
          }
          // 'ignore' = do nothing
        }
      }
    }

    try {
      const pageInfo = await service.getPageInfo();
      await storeWebsiteSnapshot({
        url: pageInfo.url,
        title: pageInfo.title,
        elements: [],
      });
    } catch (error) {
      console.warn('[BrowserHandler] Failed to persist website metadata after navigation', error);
    }
  }

  /**
   * Take screenshot
   */
  async screenshot(sessionId: string, options?: ScreenshotOptions): Promise<Buffer> {
    const service = this.getService(sessionId);
    return await service.screenshot(options);
  }

  /**
   * Click element
   */
  async click(sessionId: string, selector: string): Promise<void> {
    const service = this.getService(sessionId);
    await service.interact({ type: 'click', selector });
  }

  /**
   * Type into input field
   */
  async type(sessionId: string, selector: string, text: string): Promise<void> {
    const service = this.getService(sessionId);
    await service.interact({ type: 'type', selector, value: text });
  }

  /**
   * Select option from dropdown
   */
  async select(sessionId: string, selector: string, value: string): Promise<void> {
    const service = this.getService(sessionId);
    await service.interact({ type: 'select', selector, value });
  }

  /**
   * Hover over element
   */
  async hover(sessionId: string, selector: string): Promise<void> {
    const service = this.getService(sessionId);
    await service.interact({ type: 'hover', selector });
  }

  /**
   * Scroll page
   */
  async scroll(sessionId: string, x: number = 0, y: number = 0): Promise<void> {
    const service = this.getService(sessionId);
    await service.interact({ type: 'scroll', options: { x, y } });
  }

  /**
   * Wait for element
   */
  async waitForSelector(
    sessionId: string,
    selector: string,
    options?: { timeout?: number; state?: 'attached' | 'detached' | 'visible' | 'hidden' }
  ): Promise<void> {
    const service = this.getService(sessionId);
    await service.waitFor({ selector, ...options });
  }

  /**
   * Execute JavaScript
   */
  async evaluate<T>(sessionId: string, script: string | Function, ...args: any[]): Promise<T> {
    const service = this.getService(sessionId);
    return await service.evaluate<T>(script, ...args);
  }

  /**
   * Get page info
   */
  async getPageInfo(sessionId: string): Promise<PageInfo> {
    const service = this.getService(sessionId);
    return await service.getPageInfo();
  }

  /**
   * Get page HTML
   */
  async getHTML(sessionId: string): Promise<string> {
    const service = this.getService(sessionId);
    return await service.getHTML();
  }

  /**
   * Collect metadata about elements on the current page.
   */
  async getElements(
    sessionId: string,
    options?: ElementQueryOptions
  ): Promise<{ page: PageSnapshot | null; elements: PageElement[] }> {
    const service = this.getService(sessionId);
    const evaluateOptions: ElementQueryOptions = {
      ...(options || {}),
    };
    if (evaluateOptions.limit === undefined) {
      evaluateOptions.limit = 500;
    }
    const requestingAllTags = evaluateOptions.tags?.includes('*');
    if (requestingAllTags) {
      evaluateOptions.tags = undefined;
    } else if (!evaluateOptions.tags || evaluateOptions.tags.length === 0) {
      evaluateOptions.tags = [...INTERACTIVE_TAGS];
    }

    const elements = await service.getElements(evaluateOptions);

    let page: PageSnapshot | null = null;
    try {
      const pageInfo = await service.getPageInfo();
      let html: string | undefined;
      try {
        html = await service.getHTML();
      } catch (htmlError) {
        console.warn('[BrowserHandler] Failed to fetch page HTML for snapshot', htmlError);
      }

      page = await storeWebsiteSnapshot({
        url: pageInfo.url,
        title: pageInfo.title,
        html,
        elements,
      });
    } catch (error) {
      console.warn('[BrowserHandler] Failed to persist website snapshot', error);
    }

    await this.persistCurrentSession(service);
    await this.logActivity(sessionId, 'extraction', 'collect-elements', {
      metadata: {
        options: evaluateOptions,
        returnedCount: elements.length,
        storedInteractiveCount: page?.elementCount ?? 0,
        websiteId: page?.websiteId ?? null,
        pageId: page?.pageId ?? null,
      },
    });

    return { page, elements };
  }

  /**
   * Try to trigger a logout flow on the current page.
   */
  async logout(sessionId: string, options?: LogoutOptions): Promise<boolean> {
    const service = this.getService(sessionId);
    return await service.logout(options);
  }

  /**
   * Go back
   */
  async goBack(sessionId: string): Promise<void> {
    const service = this.getService(sessionId);
    await service.goBack();
  }

  /**
   * Go forward
   */
  async goForward(sessionId: string): Promise<void> {
    const service = this.getService(sessionId);
    await service.goForward();
  }

  /**
   * Reload page
   */
  async reload(sessionId: string): Promise<void> {
    const service = this.getService(sessionId);
    await service.reload();
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): BrowserSession | null {
    const service = this.instances.get(sessionId);
    return service ? service.getSession() : null;
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): BrowserSession[] {
    const sessions: BrowserSession[] = [];
    for (const service of this.instances.values()) {
      const session = service.getSession();
      if (session) {
        sessions.push(session);
      }
    }
    return sessions;
  }

  /**
   * Close session (supports both Stealth and Legacy!)
   */
  async closeSession(sessionId: string): Promise<void> {
    // Check if it's a stealth session first
    const stealthSession = this.stealthSessions.get(sessionId);
    if (stealthSession) {
      await browserStealthService.closeSession(sessionId);
      this.stealthSessions.delete(sessionId);
      this.sessionConfigs.delete(sessionId);
      return;
    }

    // Otherwise, handle legacy session
    const service = this.instances.get(sessionId);
    if (service) {
      await service.close();
      this.instances.delete(sessionId);
      this.sessionConfigs.delete(sessionId);
    }
  }

  /**
   * Close all sessions
   */
  async closeAllSessions(): Promise<void> {
    const promises = Array.from(this.instances.keys()).map((sessionId) =>
      this.closeSession(sessionId)
    );
    await Promise.all(promises);
  }

  private async persistSessionData(
    session: BrowserSession | null | undefined,
    options: { config?: Partial<BrowserConfig>; metadata?: Record<string, unknown> } = {}
  ): Promise<void> {
    if (!session) return;

    const sessionConfig = options.config ?? this.sessionConfigs.get(session.id);

    try {
      await upsertBrowserSession({
        session,
        config: sessionConfig,
        metadata: options.metadata ?? null,
      });
    } catch (error) {
      console.warn('[BrowserHandler] Failed to persist browser session', error);
    }
  }

  private async persistCurrentSession(service: BrowserService): Promise<void> {
    const session = service.getSession();
    await this.persistSessionData(session);
  }

  private async logActivity(
    sessionId: string | null | undefined,
    type: BrowserActivityType,
    action: string,
    details: {
      target?: string;
      value?: string;
      metadata?: Record<string, unknown>;
      success?: boolean;
      error?: string;
      duration?: number;
      timestamp?: Date;
    } = {}
  ): Promise<void> {
    if (!sessionId) return;

    try {
      await recordBrowserActivity({
        sessionId,
        type,
        action,
        target: details.target ?? null,
        value: details.value ?? null,
        metadata: details.metadata ?? null,
        success: details.success ?? true,
        error: details.error ?? null,
        duration: details.duration ?? null,
        timestamp: details.timestamp,
      });
    } catch (error) {
      console.warn('[BrowserHandler] Failed to record browser activity', error);
    }
  }

  private async handleServiceEvent(
    service: BrowserService,
    event: string,
    payload: any
  ): Promise<void> {
    switch (event) {
      case 'session:closed': {
        const session = payload?.session as BrowserSession | undefined;
        if (session) {
          await this.persistSessionData(session);
          this.sessionConfigs.delete(session.id);
        }
        break;
      }
      case 'navigation:start': {
        await this.persistCurrentSession(service);
        const session = service.getSession();
        await this.logActivity(session?.id, 'navigation', 'start', {
          target: payload?.url,
          metadata: payload ? { options: payload } : undefined,
        });
        break;
      }
      case 'navigation:complete': {
        await this.persistCurrentSession(service);
        const session = service.getSession();
        await this.logActivity(session?.id, 'navigation', 'complete', {
          target: payload?.url ?? session?.currentUrl ?? undefined,
          metadata: payload ? { title: payload.title ?? null } : undefined,
        });
        break;
      }
      case 'navigation:error': {
        await this.persistCurrentSession(service);
        const session = service.getSession();
        const errorMessage =
          payload instanceof Error ? payload.message : String(payload);
        await this.logActivity(session?.id, 'navigation', 'error', {
          success: false,
          error: errorMessage,
        });
        break;
      }
      case 'interaction:complete': {
        await this.persistCurrentSession(service);
        const session = service.getSession();
        await this.logActivity(session?.id, 'interaction', payload?.type ?? 'unknown', {
          target: payload?.selector,
          value: payload?.value,
          metadata: payload ? { options: payload.options ?? null } : undefined,
        });
        break;
      }
      case 'interaction:error': {
        await this.persistCurrentSession(service);
        const session = service.getSession();
        const interaction = payload?.interaction;
        const error = payload?.error;
        const errorMessage =
          error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);
        await this.logActivity(session?.id, 'interaction', interaction?.type ?? 'unknown', {
          target: interaction?.selector,
          value: interaction?.value,
          success: false,
          error: errorMessage,
          metadata: interaction ? { options: interaction.options ?? null } : undefined,
        });
        break;
      }
      case 'cookie:rejected': {
        await this.persistCurrentSession(service);
        const session = service.getSession();
        await this.logActivity(session?.id, 'interaction', 'cookie:rejected', {
          target: payload?.selector,
          metadata: payload ? { label: payload.label ?? null } : undefined,
        });
        break;
      }
      case 'screenshot:taken': {
        await this.persistCurrentSession(service);
        const session = service.getSession();
        await this.logActivity(session?.id, 'screenshot', 'capture', {
          metadata: payload ? { size: payload.size, options: payload.options } : undefined,
        });
        break;
      }
      case 'screenshot:error': {
        await this.persistCurrentSession(service);
        const session = service.getSession();
        const errorMessage =
          payload instanceof Error ? payload.message : String(payload);
        await this.logActivity(session?.id, 'screenshot', 'error', {
          success: false,
          error: errorMessage,
        });
        break;
      }
      case 'page:loaded':
      case 'page:domready': {
        await this.persistCurrentSession(service);
        break;
      }
      case 'page:console': {
        await this.persistCurrentSession(service);
        const session = service.getSession();
        await this.logActivity(session?.id, 'script', 'console', {
          metadata: payload,
        });
        break;
      }
      case 'page:error': {
        await this.persistCurrentSession(service);
        const session = service.getSession();
        const errorMessage =
          payload instanceof Error ? payload.message : String(payload);
        await this.logActivity(session?.id, 'script', 'page:error', {
          success: false,
          error: errorMessage,
        });
        break;
      }
      case 'page:requestfailed': {
        await this.persistCurrentSession(service);
        const session = service.getSession();
        await this.logActivity(session?.id, 'script', 'requestfailed', {
          target: payload?.url,
          metadata: payload,
          success: false,
          error: payload?.failure?.errorText ?? null,
        });
        break;
      }
      case 'session:logout': {
        const session = service.getSession();
        await this.persistSessionData(session);
        await this.logActivity(session?.id, 'interaction', 'logout', {
          metadata: payload,
        });
        break;
      }
      case 'session:logout:failed': {
        const session = service.getSession();
        await this.logActivity(session?.id, 'interaction', 'logout:failed', {
          success: false,
          metadata: payload,
        });
        break;
      }
      case 'error': {
        const session = service.getSession();
        const errorMessage =
          payload instanceof Error ? payload.message : String(payload);
        await this.logActivity(session?.id, 'script', 'service:error', {
          success: false,
          error: errorMessage,
        });
        break;
      }
      default:
        break;
    }
  }

  /**
   * Setup event forwarding from service
   */
  private setupEventForwarding(service: BrowserService): void {
    const events = [
      'session:created',
      'session:closed',
      'session:logout',
      'session:logout:failed',
      'navigation:start',
      'navigation:complete',
      'navigation:error',
      'screenshot:taken',
      'screenshot:error',
      'interaction:complete',
      'interaction:error',
      'page:loaded',
      'page:domready',
      'page:console',
      'page:error',
      'page:requestfailed',
      'cookie:rejected',
      'captcha:detected',
      'captcha:solved',
      'captcha:error',
      'captcha:notfound',
      'captcha:warning',
      'error',
    ];

    events.forEach((event) => {
      service.on(event, (data) => {
        // Log for debugging
        console.log(`[BrowserController] ${event}`, data);
        void this.handleServiceEvent(service, event, data);
      });
    });
  }

  /**
   * Helper: Navigate and wait for selector
   */
  async navigateAndWait(
    sessionId: string,
    url: string,
    selector: string,
    options?: { timeout?: number }
  ): Promise<void> {
    await this.navigate(sessionId, url);
    await this.waitForSelector(sessionId, selector, options);
  }

  /**
   * Helper: Type and submit form
   */
  async fillAndSubmit(
    sessionId: string,
    fields: Array<{ selector: string; value: string }>,
    submitSelector: string
  ): Promise<void> {
    for (const field of fields) {
      await this.type(sessionId, field.selector, field.value);
    }
    await this.click(sessionId, submitSelector);
  }

  /**
   * Helper: Extract data from page
   */
  async extractData<T>(
    sessionId: string,
    extractor: () => T
  ): Promise<T> {
    return await this.evaluate(sessionId, extractor);
  }

  /**
   * Click element with humanized mouse movement (Bezier curves)
   */
  async clickHumanized(sessionId: string, selector: string, options?: { button?: 'left' | 'right' | 'middle'; clickCount?: number }): Promise<void> {
    const service = this.getService(sessionId);
    await service.clickHumanized(selector, options);
    await this.persistCurrentSession(service);
    await this.logActivity(sessionId, 'interaction', 'click-humanized', {
      target: selector,
      metadata: { humanized: true, options },
    });
  }

  /**
   * Type text with humanized timing and occasional typos
   */
  async typeHumanized(sessionId: string, text: string, selector?: string): Promise<void> {
    const service = this.getService(sessionId);
    await service.typeHumanized(text, selector);
    await this.persistCurrentSession(service);
    await this.logActivity(sessionId, 'interaction', 'type-humanized', {
      target: selector,
      value: text,
      metadata: { humanized: true },
    });
  }

  /**
   * Scroll page with humanized behavior
   */
  async scrollHumanized(sessionId: string, options?: { direction?: 'up' | 'down'; amount?: number; smooth?: boolean }): Promise<void> {
    const service = this.getService(sessionId);
    await service.scrollHumanized(options);
    await this.persistCurrentSession(service);
    await this.logActivity(sessionId, 'interaction', 'scroll-humanized', {
      metadata: { humanized: true, options },
    });
  }

  /**
   * Simulate human reading behavior (random mouse movements and scrolling)
   */
  async simulateReading(sessionId: string, duration?: number): Promise<void> {
    const service = this.getService(sessionId);
    await service.simulateReading(duration);
    await this.persistCurrentSession(service);
    await this.logActivity(sessionId, 'interaction', 'simulate-reading', {
      metadata: { duration },
    });
  }

  /**
   * Auto-detect and solve any CAPTCHA on current page
   */
  async solveCaptchaAuto(sessionId: string): Promise<{ type: string; solution: string } | null> {
    const service = this.getService(sessionId);
    const result = await service.solveAnyCaptcha();
    await this.persistCurrentSession(service);
    await this.logActivity(sessionId, 'interaction', 'captcha-solve-auto', {
      metadata: { type: result?.type, success: !!result },
      success: !!result,
    });
    return result;
  }

  /**
   * Solve reCAPTCHA v2 on current page
   */
  async solveRecaptchaV2(sessionId: string): Promise<string | null> {
    const service = this.getService(sessionId);
    const solution = await service.solveRecaptchaV2();
    await this.persistCurrentSession(service);
    await this.logActivity(sessionId, 'interaction', 'captcha-solve-recaptcha-v2', {
      metadata: { success: !!solution },
      success: !!solution,
    });
    return solution;
  }

  /**
   * Solve hCaptcha on current page
   */
  async solveHCaptcha(sessionId: string): Promise<string | null> {
    const service = this.getService(sessionId);
    const solution = await service.solveHCaptcha();
    await this.persistCurrentSession(service);
    await this.logActivity(sessionId, 'interaction', 'captcha-solve-hcaptcha', {
      metadata: { success: !!solution },
      success: !!solution,
    });
    return solution;
  }

  /**
   * Helper: Check if user is logged in
   */
  async isLoggedIn(sessionId: string): Promise<boolean> {
    const service = this.getService(sessionId);

    // 1. Check cookies for auth-like markers
    const hasAuthCookie = await service.evaluate(() => {
      return document.cookie.split(';').some((c) => {
        const value = c.trim().toLowerCase();
        return (
          value.startsWith('auth') ||
          value.includes('session') ||
          value.includes('token')
        );
      });
    });

    // 2. Check DOM for elements that only exist when logged in
    const hasUserUI = await service.evaluate(() => {
      const logoutBtn = Array.from(document.querySelectorAll('button, a')).some(
        (el) => el.textContent && el.textContent.toLowerCase().includes('logout')
      );

      const accountLink = Array.from(
        document.querySelectorAll('a, nav, header')
      ).some((el) => {
        const txt = (el.textContent || '').toLowerCase();
        return (
          txt.includes('account') ||
          txt.includes('profil') ||
          txt.includes('dashboard') ||
          txt.includes('mein konto') ||
          txt.includes('abmelden')
        );
      });

      return logoutBtn || accountLink;
    });

    // 3. Check URL – bist du immer noch auf der Login-Seite?
    const pageInfo = await this.getPageInfo(sessionId);
    const stillOnLoginPage = pageInfo.url.includes('/sign-in');

    if ((hasAuthCookie || hasUserUI) && !stillOnLoginPage) {
      return true;
    }

    if (pageInfo.url.includes('/user')) {
      return true;
    }

    return false;
  }
}

/**
 * Export singleton instance with SENSIBLE DEFAULTS
 *
 * All defaults are optimized for maximum stealth and safety:
 * - Stealth Mode: ON (Chromium + Extensions)
 * - Headless: OFF (visible = more authentic)
 * - Humanized: ON (slowMo 100ms)
 * - Cookie Consent: Auto-reject
 * - Bot Detection: ON (warns if detected)
 *
 * You rarely need to configure anything!
 *
 * Usage:
 *   // Simple session (no profile)
 *   const session = await browserHandler.createSession();
 *
 *   // Persistent profile (stays logged in!)
 *   const session = await browserHandler.createSession({
 *     persistProfile: 'onlogist',
 *   });
 */
export const browserHandler = new BrowserHandler({
  // Internal defaults (rarely changed)
  headless: false, // Visible = more authentic
  slowMo: 100, // Humanized timing
  cookieConsent: {
    autoReject: true, // Always reject cookies automatically
  },
  navigation: {
    waitUntil: 'domcontentloaded', // Fast enough for most cases
    timeout: 45000, // 45s timeout
  },
});
