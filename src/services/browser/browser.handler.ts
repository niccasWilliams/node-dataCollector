import { BrowserService } from './browser.service';
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

/**
 * BrowserUseCase - High-level API for browser automation
 *
 * Manages multiple browser instances and provides a clean API
 */
export class BrowserHandler {
  private instances: Map<string, BrowserService> = new Map();
  private defaultConfig: Partial<BrowserConfig>;
  private sessionConfigs: Map<string, Partial<BrowserConfig>> = new Map();

  constructor(defaultConfig: Partial<BrowserConfig> = {}) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Create a new browser session
   */
  async createSession(config?: Partial<BrowserConfig>): Promise<BrowserSession> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const sanitizedConfig = JSON.parse(JSON.stringify(mergedConfig ?? {})) as Partial<BrowserConfig>;
    const service = new BrowserService(mergedConfig);

    // Setup event forwarding
    this.setupEventForwarding(service);

    const session = await service.initialize();
    this.instances.set(session.id, service);
    this.sessionConfigs.set(session.id, sanitizedConfig);

    await this.persistSessionData(session, { config: sanitizedConfig });

    return session;
  }

  /**
   * Get browser service by session ID
   */
  private getService(sessionId: string): BrowserService {
    const service = this.instances.get(sessionId);
    if (!service) {
      throw new Error(`Browser session not found: ${sessionId}`);
    }
    return service;
  }

  /**
   * Navigate to URL
   */
  async navigate(sessionId: string, url: string, options?: Partial<NavigationOptions>): Promise<void> {
    const service = this.getService(sessionId);
    await service.navigate({ url, ...options });
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
   * Close session
   */
  async closeSession(sessionId: string): Promise<void> {
    const service = this.getService(sessionId);
    await service.close();
    this.instances.delete(sessionId);
    this.sessionConfigs.delete(sessionId);
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

// Export singleton instance
export const browserHandler = new BrowserHandler({
  headless: false,
  slowMo: 100,
  cookieConsent: {
    autoReject: true,
  },
  navigation: {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  },
});
