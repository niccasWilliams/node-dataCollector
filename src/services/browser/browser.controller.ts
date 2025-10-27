import { BrowserService } from './browser.service';
import type {
  BrowserSession,
  NavigationOptions,
  ScreenshotOptions,
  PageInteraction,
  BrowserConfig,
  PageInfo,
} from '../../types/browser.types';

/**
 * BrowserController - High-level API for browser automation
 *
 * Manages multiple browser instances and provides a clean API
 */
export class BrowserController {
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
}

// Export singleton instance
export const browserController = new BrowserController({
  headless: false,
  slowMo: 100,
});
