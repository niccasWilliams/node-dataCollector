import { BrowserService } from './browser.service';
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

/**
 * BrowserUseCase - High-level API for browser automation
 *
 * Manages multiple browser instances and provides a clean API
 */
export class BrowserHandler {
  private instances: Map<string, BrowserService> = new Map();
  private defaultConfig: Partial<BrowserConfig>;

  constructor(defaultConfig: Partial<BrowserConfig> = {}) {
    this.defaultConfig = defaultConfig;
  }

  /**
   * Create a new browser session
   */
  async createSession(config?: Partial<BrowserConfig>): Promise<BrowserSession> {
    const mergedConfig = { ...this.defaultConfig, ...config };
    const service = new BrowserService(mergedConfig);

    // Setup event forwarding
    this.setupEventForwarding(service);

    const session = await service.initialize();
    this.instances.set(session.id, service);

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
  ): Promise<PageElement[]> {
    const service = this.getService(sessionId);
    return await service.getElements(options);
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
      'error',
    ];

    events.forEach((event) => {
      service.on(event, (data) => {
        // Log for debugging
        console.log(`[BrowserController] ${event}`, data);
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
});
