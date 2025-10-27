export interface BrowserSession {
  id: string;
  status: 'idle' | 'active' | 'navigating' | 'closed';
  currentUrl: string | null;
  title: string | null;
  createdAt: Date;
  lastActivityAt: Date;
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

export interface BrowserConfig {
  headless?: boolean;
  slowMo?: number;
  devtools?: boolean;
  executablePath?: string;
  args?: string[];
  viewport?: {
    width: number;
    height: number;
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
