import { EventEmitter } from 'events';
import type { Page } from 'patchright';
import type { URLChangedEvent } from './types/browser-events.types';

/**
 * URL Tracker Service
 *
 * Überwacht alle URL-Änderungen in einer Browser-Session:
 * - Programmatische Navigation (via .goto())
 * - Manuelle Navigation (User klickt auf Links, benutzt Back/Forward)
 * - Redirects
 * - History-Tracking
 */

export interface URLHistoryEntry {
  url: string;
  title: string | null;
  timestamp: Date;
  source: 'programmatic' | 'manual' | 'redirect';
}

export interface TrackedURL {
  sessionId: string;
  currentUrl: string | null;
  previousUrl: string | null;
  title: string | null;
  history: URLHistoryEntry[];
  isTracking: boolean;
}

export class URLTracker extends EventEmitter {
  private trackedSessions: Map<string, TrackedURL> = new Map();
  private urlCheckIntervals: Map<string, NodeJS.Timeout> = new Map();

  private readonly URL_CHECK_INTERVAL = 500; // Prüfe alle 500ms

  /**
   * Startet URL-Tracking für eine Session
   */
  startTracking(sessionId: string, page: Page, initialUrl: string | null = null): void {
    // Stoppe existierendes Tracking
    this.stopTracking(sessionId);

    // Initialisiere Tracking
    const tracked: TrackedURL = {
      sessionId,
      currentUrl: initialUrl,
      previousUrl: null,
      title: null,
      history: initialUrl
        ? [
            {
              url: initialUrl,
              title: null,
              timestamp: new Date(),
              source: 'programmatic',
            },
          ]
        : [],
      isTracking: true,
    };

    this.trackedSessions.set(sessionId, tracked);

    // Setup Page Frame Navigation Listener (fängt fast alle Navigationen)
    this.setupPageListeners(sessionId, page);

    // Zusätzlich: Polling als Fallback für Fälle die Events verpassen
    const interval = setInterval(() => {
      void this.checkURLChange(sessionId, page);
    }, this.URL_CHECK_INTERVAL);

    this.urlCheckIntervals.set(sessionId, interval);

    console.log(`[URLTracker] Started tracking URLs for session: ${sessionId}`);
  }

  /**
   * Stoppt URL-Tracking für eine Session
   */
  stopTracking(sessionId: string): void {
    // Stoppe Polling
    const interval = this.urlCheckIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.urlCheckIntervals.delete(sessionId);
    }

    // Markiere als nicht mehr trackend
    const tracked = this.trackedSessions.get(sessionId);
    if (tracked) {
      tracked.isTracking = false;
      this.trackedSessions.set(sessionId, tracked);
    }

    console.log(`[URLTracker] Stopped tracking URLs for session: ${sessionId}`);
  }

  /**
   * Registriert eine programmatische URL-Änderung
   */
  registerProgrammaticNavigation(sessionId: string, url: string, title?: string): void {
    const tracked = this.trackedSessions.get(sessionId);
    if (!tracked) return;

    this.updateURL(sessionId, url, title ?? null, 'programmatic');
  }

  /**
   * Gibt die aktuelle URL einer Session zurück
   */
  getCurrentURL(sessionId: string): string | null {
    return this.trackedSessions.get(sessionId)?.currentUrl ?? null;
  }

  /**
   * Gibt die History einer Session zurück
   */
  getHistory(sessionId: string): URLHistoryEntry[] {
    return this.trackedSessions.get(sessionId)?.history ?? [];
  }

  /**
   * Gibt tracked data zurück
   */
  getTrackedData(sessionId: string): TrackedURL | null {
    return this.trackedSessions.get(sessionId) ?? null;
  }

  /**
   * Setup Page Event Listeners für URL-Änderungen
   */
  private setupPageListeners(sessionId: string, page: Page): void {
    // Frame Navigated Event - fängt die meisten Navigationen
    page.on('framenavigated', async (frame) => {
      // Nur Main Frame interessiert uns
      if (frame !== page.mainFrame()) return;

      try {
        const url = frame.url();
        const title = await page.title().catch(() => null);

        // Prüfe ob sich URL wirklich geändert hat
        const tracked = this.trackedSessions.get(sessionId);
        if (tracked && url !== tracked.currentUrl) {
          // Bestimme Source (manual vs redirect)
          // Wenn wir keinen programmatic call registriert haben, ist es manual/redirect
          const source = this.isLikelyRedirect(url, tracked.currentUrl)
            ? 'redirect'
            : 'manual';

          this.updateURL(sessionId, url, title, source);
        }
      } catch (error) {
        console.warn(`[URLTracker] Error in framenavigated handler:`, error);
      }
    });
  }

  /**
   * Prüft ob sich die URL geändert hat (Polling Fallback)
   */
  private async checkURLChange(sessionId: string, page: Page): Promise<void> {
    try {
      const tracked = this.trackedSessions.get(sessionId);
      if (!tracked || !tracked.isTracking) return;

      const currentPageURL = page.url();
      const currentTitle = await page.title().catch(() => null);

      // URL hat sich geändert
      if (currentPageURL !== tracked.currentUrl) {
        const source = this.isLikelyRedirect(currentPageURL, tracked.currentUrl)
          ? 'redirect'
          : 'manual';

        this.updateURL(sessionId, currentPageURL, currentTitle, source);
      }
      // Nur Title hat sich geändert
      else if (currentTitle && currentTitle !== tracked.title) {
        tracked.title = currentTitle;
        this.trackedSessions.set(sessionId, tracked);
      }
    } catch (error) {
      // Page könnte closed sein - ignorieren
    }
  }

  /**
   * Updated die URL und emittiert Event
   */
  private updateURL(
    sessionId: string,
    newUrl: string,
    title: string | null,
    source: 'programmatic' | 'manual' | 'redirect'
  ): void {
    const tracked = this.trackedSessions.get(sessionId);
    if (!tracked) return;

    const previousUrl = tracked.currentUrl;

    // Update Tracked Data
    tracked.previousUrl = previousUrl;
    tracked.currentUrl = newUrl;
    tracked.title = title;

    // Füge zu History hinzu
    tracked.history.push({
      url: newUrl,
      title,
      timestamp: new Date(),
      source,
    });

    // Limitiere History auf letzte 100 Einträge
    if (tracked.history.length > 100) {
      tracked.history = tracked.history.slice(-100);
    }

    this.trackedSessions.set(sessionId, tracked);

    // Emit URL Changed Event
    const event: URLChangedEvent = {
      sessionId,
      previousUrl,
      currentUrl: newUrl,
      title,
      timestamp: new Date(),
      source,
    };
    this.emit('url:changed', event);

    console.log(
      `[URLTracker] URL changed [${source}]: ${previousUrl || 'none'} -> ${newUrl}`
    );
  }

  /**
   * Heuristik: Ist das ein Redirect?
   * Redirects passieren meist sehr schnell nach einer Navigation
   */
  private isLikelyRedirect(newUrl: string, oldUrl: string | null): boolean {
    if (!oldUrl) return false;

    try {
      const oldDomain = new URL(oldUrl).hostname;
      const newDomain = new URL(newUrl).hostname;

      // Wenn Domain sich ändert, ist es wahrscheinlich ein Redirect
      // (z.B. Login -> Redirect zu Dashboard)
      return oldDomain !== newDomain;
    } catch {
      return false;
    }
  }

  /**
   * Cleanup - stoppt alle Trackings
   */
  cleanup(): void {
    console.log('[URLTracker] Cleaning up all tracked sessions...');

    for (const sessionId of Array.from(this.trackedSessions.keys())) {
      this.stopTracking(sessionId);
    }

    this.trackedSessions.clear();
    this.urlCheckIntervals.clear();
  }
}
