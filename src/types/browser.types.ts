export interface BrowserSession {
  id: string;
  status: 'idle' | 'active' | 'navigating' | 'closed';
  currentUrl: string | null;
  title: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  closedAt?: Date; // Optional: When session was closed
}

export interface NavigationOptions {
  url: string;
  waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  timeout?: number;
}

export interface ScreenshotOptions {
  fullPage?: boolean;
  quality?: number;
  type?: 'png' | 'jpeg';
  path?: string;
}

/**
 * BrowserConfig - Simplified Configuration
 *
 * Most settings are now internal defaults for maximum safety:
 * - Stealth Mode: Always ON (Chromium + Extensions)
 * - Humanized: Always ON (slowMo 100ms, natural interactions)
 * - Headless: Always OFF (visible for authenticity)
 * - Cookie Consent: Always auto-reject
 *
 * Only configure what you really need!
 */
export interface BrowserConfig {
  // ========== PROFILE MANAGEMENT ==========
  /**
   * Use persistent browser profile (stays logged in across sessions!)
   * - true: Auto-create profile based on first URL
   * - string: Use specific profile name (e.g., "onlogist")
   * - false/undefined: Temporary session (default)
   *
   * Example:
   *   persistProfile: 'onlogist'  // Always same fingerprint & cookies
   */
  persistProfile?: boolean | string;

  // ========== BOT DETECTION ==========
  /**
   * Enable automatic bot-detection detection (monitors for CAPTCHA, blocks, etc.)
   * DEFAULT: true
   */
  botDetection?: boolean;

  /**
   * What to do when bot detection is detected:
   * - 'warn': Log warning and continue (default)
   * - 'stop': Stop session immediately
   * - 'ignore': Don't check at all
   */
  onBotDetected?: 'warn' | 'stop' | 'ignore';

  // ========== INTERNAL (rarely needed) ==========
  /**
   * @internal - Use legacy browser (NOT RECOMMENDED!)
   * Default: false (always use Stealth)
   */
  useStealth?: boolean;

  /**
   * @internal - Custom Chrome extensions (rarely needed)
   * Default: Dummy extension for authenticity
   */
  extensions?: string[];

  /**
   * @internal - Cookie consent config (rarely needed)
   * Default: Auto-reject enabled
   */
  cookieConsent?: CookieConsentConfig;

  /**
   * @internal - Navigation defaults (rarely needed)
   * Default: domcontentloaded, 45s timeout
   */
  navigation?: {
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
    timeout?: number;
  };

  /**
   * @internal - Headless mode (NOT RECOMMENDED for stealth!)
   * Default: false (visible)
   */
  headless?: boolean;

  /**
   * @internal - Slow motion delay (ms)
   * Default: 100ms (humanized)
   */
  slowMo?: number;
}

export interface CookieConsentConfig {
  autoReject?: boolean;
  /**
   * Custom selectors to try when rejecting cookies (evaluated before keyword heuristics).
   */
  selectors?: string[];
  /**
   * Additional keywords that indicate a reject action.
   */
  keywords?: string[];
  /**
   * Keywords to explicitly avoid (e.g. "accept all").
   */
  ignoreKeywords?: string[];
  /**
   * How long to wait (ms) for a banner before giving up.
   */
  timeout?: number;
  /**
   * Delay after clicking reject so overlays can disappear (ms).
   */
  postClickDelay?: number;
  /**
   * Enable a short humanized warmup (delay, mouse move, scroll) before searching for banners.
   * Defaults to true.
   */
  humanizedWarmup?: boolean;
  /**
   * Delay range in milliseconds before attempting to dismiss a banner.
   */
  warmupDelayRange?: {
    min?: number;
    max?: number;
  };
  /**
   * Scroll distance range in pixels for the warmup behaviour.
   */
  warmupScrollRange?: {
    min?: number;
    max?: number;
  };
}

export interface PageInteraction {
  type: 'click' | 'type' | 'select' | 'hover' | 'scroll';
  selector?: string;
  value?: string;
  options?: Record<string, any>;
}

export interface BrowserActivity {
  id: string;
  sessionId: string;
  type: 'navigation' | 'screenshot' | 'interaction' | 'script';
  action: string;
  metadata: Record<string, any>;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface PageInfo {
  url: string;
  title: string;
  html?: string;
  cookies?: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
  }>;
  localStorage?: Record<string, string>;
}

export interface WaitForOptions {
  selector?: string;
  timeout?: number;
  state?: 'attached' | 'detached' | 'visible' | 'hidden';
}

export interface ElementQueryOptions {
  /**
   * Restrict the lookup to specific tag names (e.g. ['button', 'a'])
   */
  tags?: string[];
  /**
   * Include hidden elements in the result set. Defaults to false.
   */
  includeHidden?: boolean;
  /**
   * Limit the amount of elements returned to avoid huge payloads.
   */
  limit?: number;
}

export interface PageElement {
  tag: string;
  selector: string;
  text: string;
  attributes: Record<string, string>;
  classes: string[];
  id?: string;
  name?: string;
  href?: string;
  type?: string;
  role?: string | null;
  formAction?: string | null;
  visible: boolean;
  disabled: boolean;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface LogoutOptions {
  /**
   * Explicit selectors to try first when attempting to logout.
   */
  selectors?: string[];
  /**
   * Custom keywords that indicate logout buttons or links.
   */
  keywords?: string[];
  /**
   * Wait for a navigation after clicking a logout element.
   */
  waitForNavigation?: boolean;
  /**
   * Timeout (in ms) for any waiting that happens during logout.
   */
  timeout?: number;
}
