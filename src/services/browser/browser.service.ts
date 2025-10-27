import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { EventEmitter } from 'events';
import type {
  BrowserSession,
  BrowserConfig,
  NavigationOptions,
  ScreenshotOptions,
  PageInteraction,
  PageInfo,
  WaitForOptions,
} from '../../types/browser.types';

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

  constructor(config: Partial<BrowserConfig> = {}) {
    super();

    // Default configuration for real Chrome
    this.config = {
      headless: false, // Show browser by default for user visibility
      slowMo: 100, // Slow down by 100ms to appear more human-like
      devtools: false,
      executablePath: this.findChromePath(),
      args: [
        '--disable-blink-features=AutomationControlled', // Hide automation detection
        '--disable-dev-shm-usage',
        '--no-sandbox', // Required for Linux
        '--disable-setuid-sandbox',
        '--disable-infobars',
        '--disable-extensions-except', // Don't load extensions
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--disable-features=TranslateUI,BlinkGenPropertyTrees',
        '--disable-hang-monitor',
        '--disable-ipc-flooding-protection',
        '--disable-popup-blocking',
        '--disable-prompt-on-repost',
        '--disable-renderer-backgrounding',
        '--disable-sync',
        '--enable-features=NetworkService,NetworkServiceInProcess',
        '--force-color-profile=srgb',
        '--metrics-recording-only',
        '--no-first-run',
        '--password-store=basic',
        '--use-mock-keychain',
        '--lang=de-DE,de', // German locale
        '--user-agent=Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      ],
      viewport: {
        width: 1920,
        height: 1080,
      },
      ...config,
    };
  }

  /**
   * Find Chrome executable path on Linux/Ubuntu
   */
  private findChromePath(): string {
    // Use real Chrome installation - verified to exist on system
    return '/usr/bin/google-chrome';
  }

  /**
   * Initialize browser session
   */
  async initialize(): Promise<BrowserSession> {
    if (this.browser) {
      throw new Error('Browser session already active');
    }

    try {
      // Launch real Chrome
      this.browser = await chromium.launch({
        headless: this.config.headless,
        executablePath: this.config.executablePath,
        args: this.config.args,
        slowMo: this.config.slowMo,
        devtools: this.config.devtools,
      });

      // Create context with realistic settings
      this.context = await this.browser.newContext({
        viewport: this.config.viewport,
        userAgent: await this.getRealisticUserAgent(),
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
        permissions: ['geolocation', 'notifications'],
        colorScheme: 'light',
        // Add realistic browser features
        hasTouch: false,
        isMobile: false,
        javaScriptEnabled: true,
      });

      // Add comprehensive anti-detection scripts
      await this.context.addInitScript(() => {
        // Override navigator.webdriver
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
          configurable: true,
        });

        // Remove webdriver property from Navigator prototype
        delete (Navigator.prototype as any).webdriver;

        // Add chrome object to make it look like a real Chrome browser
        (window as any).chrome = {
          app: {},
          runtime: {
            PlatformOs: {
              MAC: 'mac',
              WIN: 'win',
              ANDROID: 'android',
              CROS: 'cros',
              LINUX: 'linux',
              OPENBSD: 'openbsd',
            },
            PlatformArch: {
              ARM: 'arm',
              X86_32: 'x86-32',
              X86_64: 'x86-64',
            },
            PlatformNaclArch: {
              ARM: 'arm',
              X86_32: 'x86-32',
              X86_64: 'x86-64',
            },
          },
          csi: () => {},
          loadTimes: () => {},
        };

        // Add realistic plugins
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const ChromePDFPlugin = {
              0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
              description: 'Portable Document Format',
              filename: 'internal-pdf-viewer',
              length: 1,
              name: 'Chrome PDF Plugin',
            };
            const ChromePDFViewer = {
              0: { type: 'application/pdf', suffixes: 'pdf', description: '' },
              description: '',
              filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
              length: 1,
              name: 'Chrome PDF Viewer',
            };
            const NativeClient = {
              0: { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
              1: { type: 'application/x-pnacl', suffixes: '', description: 'Portable Native Client Executable' },
              description: '',
              filename: 'internal-nacl-plugin',
              length: 2,
              name: 'Native Client',
            };
            return [ChromePDFPlugin, ChromePDFViewer, NativeClient];
          },
        });

        // Override permissions API
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) => {
          if (parameters.name === 'notifications') {
            return Promise.resolve({ state: 'prompt' } as PermissionStatus);
          }
          return originalQuery.call(window.navigator.permissions, parameters);
        };

        // Make toString functions look legitimate
        Object.defineProperty(Function.prototype.toString, 'toString', {
          value: () => 'function toString() { [native code] }',
          writable: false,
          configurable: false,
        });

        // Languages - make it look realistic
        Object.defineProperty(navigator, 'languages', {
          get: () => ['de-DE', 'de', 'en-US', 'en'],
        });

        // Platform
        Object.defineProperty(navigator, 'platform', {
          get: () => 'Linux x86_64',
        });

        // Hardware concurrency (realistic CPU core count)
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => 8,
        });

        // Device memory
        Object.defineProperty(navigator, 'deviceMemory', {
          get: () => 8,
        });

        // Add realistic screen properties
        Object.defineProperty(window.screen, 'availWidth', { get: () => 1920 });
        Object.defineProperty(window.screen, 'availHeight', { get: () => 1080 });
        Object.defineProperty(window.screen, 'width', { get: () => 1920 });
        Object.defineProperty(window.screen, 'height', { get: () => 1080 });
        Object.defineProperty(window.screen, 'colorDepth', { get: () => 24 });
        Object.defineProperty(window.screen, 'pixelDepth', { get: () => 24 });

        // Canvas fingerprinting protection
        const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
        HTMLCanvasElement.prototype.toDataURL = function (type?: string) {
          const context = this.getContext('2d');
          if (context) {
            // Add slight noise to canvas data
            const imageData = context.getImageData(0, 0, this.width, this.height);
            for (let i = 0; i < imageData.data.length; i += 4) {
              imageData.data[i] += Math.floor(Math.random() * 2);
              imageData.data[i + 1] += Math.floor(Math.random() * 2);
              imageData.data[i + 2] += Math.floor(Math.random() * 2);
            }
            context.putImageData(imageData, 0, 0);
          }
          return originalToDataURL.apply(this, [type] as any);
        };

        // WebGL fingerprinting protection
        const getParameter = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function (parameter: number) {
          if (parameter === 37445) {
            return 'Intel Inc.';
          }
          if (parameter === 37446) {
            return 'Intel Iris OpenGL Engine';
          }
          return getParameter.call(this, parameter);
        };

        // Add realistic battery API
        Object.defineProperty(navigator, 'getBattery', {
          value: () =>
            Promise.resolve({
              charging: true,
              chargingTime: 0,
              dischargingTime: Infinity,
              level: 1,
            }),
        });

        // Override connection API
        Object.defineProperty(navigator, 'connection', {
          get: () => ({
            effectiveType: '4g',
            rtt: 50,
            downlink: 10,
            saveData: false,
          }),
        });

        // Console debug message
        console.log('%c🚀 Stealth Browser Initialized', 'color: green; font-weight: bold; font-size: 14px;');
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

    // Get localStorage
    const localStorage = await this.page!.evaluate(() => {
      const items: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          items[key] = window.localStorage.getItem(key) || '';
        }
      }
      return items;
    });

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

  private async getRealisticUserAgent(): Promise<string> {
    // Real Chrome user agent for Ubuntu
    return 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
  }
}
