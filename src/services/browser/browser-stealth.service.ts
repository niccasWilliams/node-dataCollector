/**
 * BrowserStealthService - MAXIMUM STEALTH Browser for Sensitive Sites
 *
 * Key differences from standard BrowserService:
 * 1. Uses launchPersistentContext (required for extensions)
 * 2. Loads Chrome extensions (makes browser look real)
 * 3. Enhanced anti-fingerprinting
 * 4. WebRTC leak protection
 * 5. Canvas/Audio fingerprinting protection
 *
 * USE THIS FOR: Onlogist, Login-protected sites, Anti-Bot-protected sites
 */

import { chromium, BrowserContext, Page } from 'patchright';
import { EventEmitter } from 'events';
import { logger } from '@/utils/logger';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { generateConsistentFingerprint, type ConsistentFingerprint } from './consistent-fingerprint';

export interface StealthBrowserConfig {
  headless?: boolean;
  slowMo?: number;
  extensions?: string[]; // Paths to extension directories
  userDataDir?: string; // Persistent profile directory
  fingerprintSeed?: number; // Seed for consistent fingerprinting
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
}

export interface StealthSession {
  id: string;
  context: BrowserContext;
  page: Page;
  status: 'idle' | 'active' | 'navigating' | 'closed';
  currentUrl: string | null;
  title: string | null;
  createdAt: Date;
  lastActivityAt: Date;
  closedAt?: Date;
  userDataDir: string;
  fingerprintSeed: number;
}

export class BrowserStealthService extends EventEmitter {
  private sessions: Map<string, StealthSession> = new Map();

  /**
   * Create a MAXIMUM STEALTH browser session
   * This is the SAFEST way to browse sensitive sites
   */
  async createStealthSession(config: StealthBrowserConfig = {}): Promise<StealthSession> {
    logger.info('[BrowserStealth] Creating ULTRA-STEALTH session...');

    // Create user data directory if not provided
    const userDataDir = config.userDataDir || path.join(os.tmpdir(), `chrome-stealth-${Date.now()}`);

    // Ensure user data dir exists
    if (!fs.existsSync(userDataDir)) {
      fs.mkdirSync(userDataDir, { recursive: true });
    }

    // Clean up stale lock files from previous sessions
    this.cleanupStaleLockFiles(userDataDir);

    // Build launch arguments with MAXIMUM STEALTH
    const args = [
      // Essential Anti-Detection (Patchright handles --disable-blink-features=AutomationControlled automatically)
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',

      // Locale
      '--lang=de-DE,de',
      '--accept-lang=de-DE,de',

      // WebRTC Leak Protection (CRITICAL!)
      '--enforce-webrtc-ip-permission-check',
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',

      // Additional Anti-Fingerprinting
      '--disable-features=AudioServiceOutOfProcess',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-site-isolation-trials',

      // Make browser look more normal
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-extensions-http-throttling',
      '--disable-features=TranslateUI',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-renderer-backgrounding',
      '--disable-sync',
      '--metrics-recording-only',
      '--no-first-run',
      '--safebrowsing-disable-auto-update',
      '--enable-automation=false',
      '--password-store=basic',
      '--use-mock-keychain',
    ];

    // Add extensions if provided
    if (config.extensions && config.extensions.length > 0) {
      args.push(`--disable-extensions-except=${config.extensions.join(',')}`);
      args.push(`--load-extension=${config.extensions.join(',')}`);
      logger.info(`[BrowserStealth] Loading ${config.extensions.length} extension(s)`);
    }

    // Add proxy if configured
    if (config.proxy) {
      args.push(`--proxy-server=${config.proxy.server}`);
      logger.info(`[BrowserStealth] Using proxy: ${config.proxy.server}`);
    }

    try {
      // Try Chrome first (more authentic), fall back to Chromium if needed
      let channel: 'chrome' | 'chromium' = 'chrome';
      let actualExtensions = config.extensions || [];

      // Chrome doesn't support extensions via launchPersistentContext
      // So if we have extensions, we MUST use Chromium
      if (actualExtensions.length > 0) {
        logger.info('[BrowserStealth] Using Chromium (required for extensions)');
        logger.info(`[BrowserStealth] Loading ${actualExtensions.length} extension(s)`);
        channel = 'chromium';
      } else {
        logger.info('[BrowserStealth] Using system Chrome (no extensions - consider adding for better stealth!)');
      }

      // Launch persistent context
      const context = await chromium.launchPersistentContext(userDataDir, {
        headless: config.headless ?? false,
        channel,
        args,
        slowMo: config.slowMo ?? 100,

        // Let Chrome use natural settings
        viewport: null, // Don't set fixed viewport
        locale: 'de-DE',
        timezoneId: 'Europe/Berlin',
        permissions: ['geolocation', 'notifications'],
        colorScheme: 'light',

        // Proxy authentication
        ...(config.proxy?.username && config.proxy?.password
          ? {
              httpCredentials: {
                username: config.proxy.username,
                password: config.proxy.password,
              },
            }
          : {}),
      });

      // Generate CONSISTENT fingerprint from seed
      const fingerprintSeed = config.fingerprintSeed ?? Math.floor(Math.random() * 1000000);
      const fingerprint = generateConsistentFingerprint(fingerprintSeed);

      if (config.fingerprintSeed !== undefined) {
        logger.info(`[BrowserStealth] 🎭 Using consistent fingerprint (seed: ${fingerprintSeed})`);
      } else {
        logger.info(`[BrowserStealth] 🎭 Using random fingerprint (seed: ${fingerprintSeed})`);
      }

      logger.info(`[BrowserStealth] 🎭 Hardware: ${fingerprint.hardwareConcurrency} cores, ${fingerprint.deviceMemory}GB RAM`);

      // Add ULTRA-STEALTH fingerprint protection scripts with PRE-GENERATED values
      await context.addInitScript(
        (fp: ConsistentFingerprint) => {

        // 1. WebRTC IP Leak Protection
        (function() {
          const getOrig = RTCPeerConnection.prototype.getStats;
          RTCPeerConnection.prototype.getStats = function() {
            return getOrig.apply(this, arguments as any);
          };

          const addIceCandidateOrig = RTCPeerConnection.prototype.addIceCandidate;
          RTCPeerConnection.prototype.addIceCandidate = function(candidate: any) {
            if (candidate && candidate.candidate && candidate.candidate.indexOf('.local') > -1) {
              return Promise.resolve(); // Block local IP leak
            }
            return addIceCandidateOrig.apply(this, arguments as any);
          };
        })();

        // 2. Canvas Fingerprinting Protection (CONSISTENT!)
        const canvasProto = HTMLCanvasElement.prototype;
        const originalToDataURL = canvasProto.toDataURL;
        const originalToBlob = canvasProto.toBlob;
        const originalGetContext = canvasProto.getContext;

        // Use PRE-GENERATED noise pattern for consistent fingerprinting!
        const noisePattern = fp.canvasNoisePattern;
        let canvasCallCount = 0;

        function addNoise(canvas: HTMLCanvasElement) {
          const ctx = originalGetContext.call(canvas, '2d') as CanvasRenderingContext2D | null;
          if (!ctx) return;

          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < imageData.data.length; i += 4) {
            // Use pre-generated pattern (cycle through if needed)
            const noiseValue = noisePattern[i % noisePattern.length];
            imageData.data[i] = imageData.data[i] ^ noiseValue;
          }
          ctx.putImageData(imageData, 0, 0);
          canvasCallCount++;
        }

        canvasProto.toDataURL = function(...args) {
          addNoise(this);
          return originalToDataURL.apply(this, args);
        };

        canvasProto.toBlob = function(...args) {
          addNoise(this);
          return originalToBlob.apply(this, args);
        };

        // 3. Audio Context Fingerprinting Protection (CONSISTENT!)
        const AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const audioPattern = fp.audioNoisePattern;
          const OriginalAnalyser = AudioContext.prototype.createAnalyser;
          AudioContext.prototype.createAnalyser = function() {
            const analyser = OriginalAnalyser.call(this);
            const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
            analyser.getFloatFrequencyData = function(array: Float32Array) {
              originalGetFloatFrequencyData.call(this, array);
              // Add consistent noise pattern
              for (let i = 0; i < array.length; i++) {
                array[i] += audioPattern[i % audioPattern.length];
              }
            };
            return analyser;
          };
        }

        // 4. WebGL Fingerprinting Protection (CONSISTENT!)
        const getParameterOrig = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          // Use pre-generated WebGL values
          if (parameter === 37445) {
            return fp.webglVendor; // UNMASKED_VENDOR_WEBGL
          }
          if (parameter === 37446) {
            return fp.webglRenderer; // UNMASKED_RENDERER_WEBGL
          }
          return getParameterOrig.call(this, parameter);
        };

        // 5. Battery API Protection (remove API completely)
        if ('getBattery' in navigator) {
          delete (navigator as any).getBattery;
        }

        // 6. Hardware Concurrency Spoofing (CONSISTENT!)
        Object.defineProperty(navigator, 'hardwareConcurrency', {
          get: () => fp.hardwareConcurrency, // Pre-generated value!
        });

        // 7. Device Memory Spoofing (CONSISTENT!)
        if ('deviceMemory' in navigator) {
          Object.defineProperty(navigator, 'deviceMemory', {
            get: () => fp.deviceMemory, // Pre-generated value (always 8)
          });
        }

        // 8. Plugins Protection (make it look like a normal browser)
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            return [
              {
                name: 'PDF Viewer',
                description: 'Portable Document Format',
                filename: 'internal-pdf-viewer',
              },
              {
                name: 'Chrome PDF Viewer',
                description: 'Portable Document Format',
                filename: 'internal-pdf-viewer',
              },
            ];
          },
        });

        // 9. Languages Protection (consistent with locale)
        Object.defineProperty(navigator, 'languages', {
          get: () => ['de-DE', 'de', 'en-US', 'en'],
        });

        // 10. Chrome Runtime Objects (Patchright adds some, we add more)
        if (!(window as any).chrome) {
          Object.defineProperty(window, 'chrome', {
            writable: true,
            enumerable: true,
            configurable: false,
            value: {
              runtime: {
                id: undefined,
                onMessage: {
                  addListener: () => {},
                  removeListener: () => {},
                },
                sendMessage: () => {},
              },
              loadTimes: function() {
                // Use PRE-GENERATED offsets for consistent timings!
                return {
                  requestTime: Date.now() / 1000 - fp.chromeLoadTimes.requestTimeOffset,
                  startLoadTime: Date.now() / 1000 - fp.chromeLoadTimes.startLoadTimeOffset,
                  commitLoadTime: Date.now() / 1000 - fp.chromeLoadTimes.commitLoadTimeOffset,
                  finishDocumentLoadTime: Date.now() / 1000 - fp.chromeLoadTimes.finishDocumentLoadTimeOffset,
                  finishLoadTime: Date.now() / 1000,
                  firstPaintTime: Date.now() / 1000 - fp.chromeLoadTimes.firstPaintTimeOffset,
                  firstPaintAfterLoadTime: 0,
                  navigationType: 'Other',
                  wasFetchedViaSpdy: false,
                  wasNpnNegotiated: false,
                  npnNegotiatedProtocol: 'unknown',
                  wasAlternateProtocolAvailable: false,
                  connectionInfo: 'unknown',
                };
              },
              csi: function() {
                // Use PRE-GENERATED offsets for consistent timings!
                return {
                  startE: Date.now() - fp.chromeCSI.startEOffset,
                  onloadT: Date.now() - fp.chromeCSI.onloadTOffset,
                  pageT: Date.now() - fp.chromeCSI.pageTOffset,
                  tran: 15,
                };
              },
              app: {
                isInstalled: false,
                InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
                RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
              },
            },
          });
        }

        // 11. Permissions API Spoofing
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = function(parameters) {
          if (parameters.name === 'notifications') {
            return Promise.resolve({ state: 'prompt' } as any);
          }
          return originalQuery.call(navigator.permissions, parameters);
        };
        },
        fingerprint // Pass entire fingerprint object!
      );

      // Get existing pages or create new one
      // launchPersistentContext might already have a page open
      const pages = context.pages();
      let page: Page;

      if (pages.length > 0) {
        // Use existing page (avoid opening multiple tabs!)
        page = pages[0];
        logger.debug('[BrowserStealth] Using existing page from context');
      } else {
        // Create new page if none exists
        page = await context.newPage();
        logger.debug('[BrowserStealth] Created new page');
      }

      // Create session (BrowserSession compatible!)
      const session: StealthSession = {
        id: this.generateSessionId(),
        context,
        page,
        status: 'idle',
        currentUrl: null,
        title: null,
        createdAt: new Date(),
        lastActivityAt: new Date(),
        userDataDir,
        fingerprintSeed,
      };

      this.sessions.set(session.id, session);

      logger.info(`[BrowserStealth] ✅ ULTRA-STEALTH session created: ${session.id}`);
      logger.info(`[BrowserStealth] User data: ${userDataDir}`);
      if (config.extensions && config.extensions.length > 0) {
        logger.info(`[BrowserStealth] ✅ ${config.extensions.length} extension(s) loaded`);
      }

      return session;
    } catch (error) {
      logger.error('[BrowserStealth] Failed to create stealth session:', error);
      throw error;
    }
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): StealthSession | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Close stealth session
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      logger.warn(`[BrowserStealth] Session not found: ${sessionId}`);
      return;
    }

    try {
      const userDataDir = session.userDataDir;

      // Close the browser context
      await session.context.close();

      // Clean up lock files after closing
      this.cleanupStaleLockFiles(userDataDir);

      this.sessions.delete(sessionId);
      logger.info(`[BrowserStealth] ✅ Session closed: ${sessionId}`);
    } catch (error) {
      logger.error(`[BrowserStealth] Failed to close session:`, error);
      throw error;
    }
  }

  /**
   * Close all sessions
   */
  async closeAllSessions(): Promise<void> {
    const sessionIds = Array.from(this.sessions.keys());
    for (const sessionId of sessionIds) {
      await this.closeSession(sessionId);
    }
  }

  /**
   * Clean up stale lock files from Chrome profile directory
   * This allows reusing profiles after previous sessions were closed
   */
  private cleanupStaleLockFiles(userDataDir: string): void {
    try {
      const lockFiles = [
        path.join(userDataDir, 'SingletonLock'),
        path.join(userDataDir, 'SingletonSocket'),
        path.join(userDataDir, 'SingletonCookie'),
      ];

      for (const lockFile of lockFiles) {
        if (fs.existsSync(lockFile)) {
          try {
            fs.unlinkSync(lockFile);
            logger.debug(`[BrowserStealth] Removed stale lock file: ${path.basename(lockFile)}`);
          } catch (error) {
            // Lock file might be in use, that's okay
            logger.debug(`[BrowserStealth] Could not remove lock file ${path.basename(lockFile)}: ${error}`);
          }
        }
      }
    } catch (error) {
      logger.warn(`[BrowserStealth] Error cleaning up lock files:`, error);
      // Don't throw - this is not critical
    }
  }

  private generateSessionId(): string {
    return `stealth-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }
}

// Export singleton
export const browserStealthService = new BrowserStealthService();
