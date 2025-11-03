import { EventEmitter } from 'events';
import type { Browser, Page } from 'patchright';
import type { BrowserSession } from '../../types/browser.types';
import type {
  BrowserDisconnectedEvent,
  BrowserHealthCheckEvent,
  SessionClosedEvent,
} from './types/browser-events.types';

/**
 * Session Monitor Service
 *
 * Überwacht Browser-Sessions auf:
 * - Disconnects (manuelles Schließen, Crashes)
 * - Health Status (ist Browser noch responsive?)
 * - Automatische Erkennung von Status-Änderungen
 */

export interface SessionMonitorConfig {
  /** Intervall für Health-Checks in ms (default: 5000) */
  healthCheckInterval?: number;
  /** Timeout für Health-Check in ms (default: 3000) */
  healthCheckTimeout?: number;
  /** Automatisch Session als 'closed' markieren bei Disconnect (default: true) */
  autoMarkClosedOnDisconnect?: boolean;
}

export interface MonitoredSession {
  sessionId: string;
  browser: Browser | null;
  page: Page | null;
  session: BrowserSession;
  isHealthy: boolean;
  lastHealthCheck: Date;
  disconnectReason?: 'manual_close' | 'crash' | 'network' | 'unknown';
}

export class SessionMonitor extends EventEmitter {
  private monitoredSessions: Map<string, MonitoredSession> = new Map();
  private healthCheckIntervals: Map<string, NodeJS.Timeout> = new Map();
  private config: Required<SessionMonitorConfig>;

  constructor(config: SessionMonitorConfig = {}) {
    super();

    this.config = {
      healthCheckInterval: config.healthCheckInterval ?? 5000,
      healthCheckTimeout: config.healthCheckTimeout ?? 3000,
      autoMarkClosedOnDisconnect: config.autoMarkClosedOnDisconnect ?? true,
    };
  }

  /**
   * Startet Monitoring für eine Session
   */
  startMonitoring(
    sessionId: string,
    browser: Browser | null,
    page: Page | null,
    session: BrowserSession
  ): void {
    // Stoppe existierendes Monitoring falls vorhanden
    this.stopMonitoring(sessionId);

    // Erstelle monitored session
    const monitored: MonitoredSession = {
      sessionId,
      browser,
      page,
      session,
      isHealthy: true,
      lastHealthCheck: new Date(),
    };

    this.monitoredSessions.set(sessionId, monitored);

    // Setup Browser Disconnect Listeners
    if (browser) {
      this.setupBrowserListeners(sessionId, browser);
    }

    // Setup Page Listeners
    if (page) {
      this.setupPageListeners(sessionId, page);
    }

    // Starte Health-Check Interval
    const interval = setInterval(() => {
      void this.performHealthCheck(sessionId);
    }, this.config.healthCheckInterval);

    this.healthCheckIntervals.set(sessionId, interval);

    console.log(`[SessionMonitor] Started monitoring session: ${sessionId}`);
  }

  /**
   * Stoppt Monitoring für eine Session
   */
  stopMonitoring(sessionId: string): void {
    // Stoppe Health-Check Interval
    const interval = this.healthCheckIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(sessionId);
    }

    // Entferne Session
    this.monitoredSessions.delete(sessionId);

    console.log(`[SessionMonitor] Stopped monitoring session: ${sessionId}`);
  }

  /**
   * Updated eine monitored session (z.B. nach Änderungen)
   */
  updateSession(sessionId: string, updates: Partial<MonitoredSession>): void {
    const monitored = this.monitoredSessions.get(sessionId);
    if (!monitored) return;

    Object.assign(monitored, updates);
    this.monitoredSessions.set(sessionId, monitored);
  }

  /**
   * Gibt den aktuellen Status einer Session zurück
   */
  getSessionStatus(sessionId: string): MonitoredSession | null {
    return this.monitoredSessions.get(sessionId) ?? null;
  }

  /**
   * Gibt alle monitored sessions zurück
   */
  getAllMonitoredSessions(): MonitoredSession[] {
    return Array.from(this.monitoredSessions.values());
  }

  /**
   * Setup Browser Event Listeners für Disconnect-Erkennung
   */
  private setupBrowserListeners(sessionId: string, browser: Browser): void {
    // Browser Disconnect Event
    browser.on('disconnected', () => {
      console.log(`[SessionMonitor] Browser disconnected: ${sessionId}`);
      this.handleBrowserDisconnect(sessionId, 'manual_close');
    });
  }

  /**
   * Setup Page Event Listeners
   */
  private setupPageListeners(sessionId: string, page: Page): void {
    // Page Close Event
    page.on('close', () => {
      console.log(`[SessionMonitor] Page closed: ${sessionId}`);
      this.handleBrowserDisconnect(sessionId, 'manual_close');
    });

    // Page Crash Event
    page.on('crash', () => {
      console.log(`[SessionMonitor] Page crashed: ${sessionId}`);
      this.handleBrowserDisconnect(sessionId, 'crash');
    });
  }

  /**
   * Führt einen Health-Check für eine Session durch
   */
  private async performHealthCheck(sessionId: string): Promise<void> {
    const monitored = this.monitoredSessions.get(sessionId);
    if (!monitored) return;

    try {
      // Prüfe ob Browser noch connected ist
      if (!monitored.browser?.isConnected()) {
        this.handleBrowserDisconnect(sessionId, 'network');
        return;
      }

      // Prüfe ob Page noch responsive ist (mit Timeout)
      if (monitored.page) {
        const startTime = Date.now();

        await Promise.race([
          monitored.page.evaluate(() => true),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error('Health check timeout')),
              this.config.healthCheckTimeout
            )
          ),
        ]);

        const responseTime = Date.now() - startTime;

        // Update Health Status
        monitored.isHealthy = true;
        monitored.lastHealthCheck = new Date();
        this.monitoredSessions.set(sessionId, monitored);

        // Emit Health Event
        const healthEvent: BrowserHealthCheckEvent = {
          sessionId,
          isHealthy: true,
          lastCheck: new Date(),
          metrics: {
            responseTime,
          },
        };
        this.emit('browser:health', healthEvent);
      }
    } catch (error) {
      console.warn(`[SessionMonitor] Health check failed for ${sessionId}:`, error);

      // Markiere als unhealthy
      monitored.isHealthy = false;
      monitored.lastHealthCheck = new Date();
      this.monitoredSessions.set(sessionId, monitored);

      // Emit Unhealthy Event
      const healthEvent: BrowserHealthCheckEvent = {
        sessionId,
        isHealthy: false,
        lastCheck: new Date(),
      };
      this.emit('browser:health', healthEvent);

      // Bei mehreren fehlgeschlagenen Health-Checks → Disconnect
      // (könnte erweitert werden mit Counter)
      this.handleBrowserDisconnect(sessionId, 'unknown');
    }
  }

  /**
   * Behandelt Browser Disconnects
   */
  private handleBrowserDisconnect(
    sessionId: string,
    reason: 'manual_close' | 'crash' | 'network' | 'unknown'
  ): void {
    const monitored = this.monitoredSessions.get(sessionId);
    if (!monitored) return;

    // Verhindere mehrfache Disconnect-Events
    if (monitored.disconnectReason) return;

    // Speichere Disconnect Reason
    monitored.disconnectReason = reason;
    monitored.isHealthy = false;
    this.monitoredSessions.set(sessionId, monitored);

    // Emit Disconnect Event
    const disconnectEvent: BrowserDisconnectedEvent = {
      sessionId,
      timestamp: new Date(),
      reason,
    };
    this.emit('browser:disconnected', disconnectEvent);

    // Auto-Update Session Status
    if (this.config.autoMarkClosedOnDisconnect) {
      monitored.session.status = 'closed';

      const closedEvent: SessionClosedEvent = {
        session: monitored.session,
        reason: reason === 'manual_close' ? 'manual' : reason === 'crash' ? 'crash' : 'error',
      };
      this.emit('session:closed', closedEvent);
    }

    // Stoppe Monitoring nach Disconnect
    this.stopMonitoring(sessionId);
  }

  /**
   * Cleanup - stoppt alle Monitorings
   */
  cleanup(): void {
    console.log('[SessionMonitor] Cleaning up all monitored sessions...');

    for (const sessionId of Array.from(this.monitoredSessions.keys())) {
      this.stopMonitoring(sessionId);
    }

    this.monitoredSessions.clear();
    this.healthCheckIntervals.clear();
  }
}
