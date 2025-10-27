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