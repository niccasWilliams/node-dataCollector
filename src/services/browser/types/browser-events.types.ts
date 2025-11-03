/**
 * Browser Event Types
 *
 * Definiert alle Events die vom Browser-System emittiert werden
 * Ermöglicht typsicheres Event-Handling
 */

import type { BrowserSession } from '../../../types/browser.types';

/**
 * Session Lifecycle Events
 */
export interface SessionCreatedEvent {
  session: BrowserSession;
}

export interface SessionClosedEvent {
  session: BrowserSession;
  reason: 'manual' | 'crash' | 'timeout' | 'error';
}

export interface SessionUpdatedEvent {
  session: BrowserSession;
  changes: Partial<BrowserSession>;
}

/**
 * URL & Navigation Events
 */
export interface URLChangedEvent {
  sessionId: string;
  previousUrl: string | null;
  currentUrl: string;
  title: string | null;
  timestamp: Date;
  source: 'programmatic' | 'manual' | 'redirect';
}

export interface NavigationStartEvent {
  sessionId: string;
  url: string;
  options?: Record<string, any>;
}

export interface NavigationCompleteEvent {
  sessionId: string;
  url: string;
  title: string | null;
  duration?: number;
}

export interface NavigationErrorEvent {
  sessionId: string;
  url?: string;
  error: Error | string;
}

/**
 * Browser Status Events
 */
export interface BrowserDisconnectedEvent {
  sessionId: string;
  timestamp: Date;
  reason: 'manual_close' | 'crash' | 'network' | 'unknown';
}

export interface BrowserReconnectedEvent {
  sessionId: string;
  timestamp: Date;
}

export interface BrowserHealthCheckEvent {
  sessionId: string;
  isHealthy: boolean;
  lastCheck: Date;
  metrics?: {
    responseTime?: number;
    memoryUsage?: number;
  };
}

/**
 * Page Events
 */
export interface PageLoadedEvent {
  sessionId: string;
  url: string;
  title: string;
}

export interface PageErrorEvent {
  sessionId: string;
  error: Error | string;
  url?: string;
}

export interface PageConsoleEvent {
  sessionId: string;
  type: 'log' | 'info' | 'warn' | 'error' | 'debug';
  message: string;
  args?: any[];
}

/**
 * Interaction Events
 */
export interface InteractionStartEvent {
  sessionId: string;
  type: string;
  target?: string;
  metadata?: Record<string, any>;
}

export interface InteractionCompleteEvent {
  sessionId: string;
  type: string;
  target?: string;
  duration?: number;
  success: boolean;
}

export interface InteractionErrorEvent {
  sessionId: string;
  type: string;
  target?: string;
  error: Error | string;
}

/**
 * Screenshot Events
 */
export interface ScreenshotTakenEvent {
  sessionId: string;
  size: number;
  format: 'png' | 'jpeg';
  fullPage: boolean;
}

export interface ScreenshotErrorEvent {
  sessionId: string;
  error: Error | string;
}

/**
 * Session Recovery Events
 */
export interface SessionInconsistencyDetectedEvent {
  sessionId: string;
  inconsistencies: Array<{
    field: string;
    expected: any;
    actual: any;
  }>;
  timestamp: Date;
}

export interface SessionRecoveryStartedEvent {
  sessionId: string;
  reason: string;
}

export interface SessionRecoveryCompleteEvent {
  sessionId: string;
  success: boolean;
  recoveredFields: string[];
}

/**
 * Event Map für typsicheres Event-Handling
 */
export interface BrowserEventMap {
  // Session Lifecycle
  'session:created': SessionCreatedEvent;
  'session:closed': SessionClosedEvent;
  'session:updated': SessionUpdatedEvent;

  // URL & Navigation
  'url:changed': URLChangedEvent;
  'navigation:start': NavigationStartEvent;
  'navigation:complete': NavigationCompleteEvent;
  'navigation:error': NavigationErrorEvent;

  // Browser Status
  'browser:disconnected': BrowserDisconnectedEvent;
  'browser:reconnected': BrowserReconnectedEvent;
  'browser:health': BrowserHealthCheckEvent;

  // Page Events
  'page:loaded': PageLoadedEvent;
  'page:domready': { sessionId: string };
  'page:error': PageErrorEvent;
  'page:console': PageConsoleEvent;
  'page:requestfailed': {
    sessionId: string;
    url: string;
    method: string;
    failure?: any;
  };

  // Interactions
  'interaction:start': InteractionStartEvent;
  'interaction:complete': InteractionCompleteEvent;
  'interaction:error': InteractionErrorEvent;

  // Screenshots
  'screenshot:taken': ScreenshotTakenEvent;
  'screenshot:error': ScreenshotErrorEvent;

  // Session Recovery
  'session:inconsistency': SessionInconsistencyDetectedEvent;
  'session:recovery:start': SessionRecoveryStartedEvent;
  'session:recovery:complete': SessionRecoveryCompleteEvent;

  // Logout
  'session:logout': { sessionId: string; selector: string; strategy: string };
  'session:logout:failed': {
    sessionId: string;
    keywords: string[];
    attemptedSelectors: string[];
  };

  // Generic Error
  error: { sessionId?: string; error: Error | string };
}

/**
 * Event Namen als Union Type
 */
export type BrowserEventName = keyof BrowserEventMap;

/**
 * Typsichere Event Emitter Utility
 */
export type BrowserEventListener<T extends BrowserEventName> = (
  event: BrowserEventMap[T]
) => void | Promise<void>;
