/**
 * BotDetectionService - Automatic Bot-Detection Detection
 *
 * Monitors pages for signs that we've been detected as a bot:
 * - CAPTCHA appearances
 * - "Access Denied" / "Blocked" pages
 * - CloudFlare/Akamai challenges
 * - Rate-limiting warnings
 * - Suspicious redirects
 * - JavaScript challenges
 */

import { Page } from 'patchright';
import { logger } from '@/utils/logger';
import { EventEmitter } from 'events';

export interface BotDetectionResult {
  detected: boolean;
  confidence: number; // 0-100
  indicators: BotDetectionIndicator[];
  timestamp: Date;
  url: string;
}

export interface BotDetectionIndicator {
  type: 'captcha' | 'blocked' | 'challenge' | 'rate-limit' | 'redirect' | 'suspicious-js';
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
  selector?: string;
}

export class BotDetectionService extends EventEmitter {
  /**
   * Check page for bot-detection indicators
   */
  async checkPage(page: Page): Promise<BotDetectionResult> {
    const indicators: BotDetectionIndicator[] = [];
    const url = page.url();

    try {
      // 1. Check for CAPTCHA (CRITICAL!)
      const captchaIndicators = await this.detectCaptcha(page);
      indicators.push(...captchaIndicators);

      // 2. Check for "Access Denied" / "Blocked" pages
      const blockedIndicators = await this.detectBlockedPage(page);
      indicators.push(...blockedIndicators);

      // 3. Check for CloudFlare/Akamai challenges
      const challengeIndicators = await this.detectChallenges(page);
      indicators.push(...challengeIndicators);

      // 4. Check for Rate-Limiting
      const rateLimitIndicators = await this.detectRateLimiting(page);
      indicators.push(...rateLimitIndicators);

      // 5. Check for suspicious redirects
      const redirectIndicators = await this.detectSuspiciousRedirects(page);
      indicators.push(...redirectIndicators);

      // 6. Check for anti-bot JavaScript
      const jsIndicators = await this.detectAntiBotJS(page);
      indicators.push(...jsIndicators);

      // Calculate confidence
      const confidence = this.calculateConfidence(indicators);
      const detected = confidence >= 50; // 50%+ = likely detected

      const result: BotDetectionResult = {
        detected,
        confidence,
        indicators,
        timestamp: new Date(),
        url,
      };

      if (detected) {
        logger.warn('[BotDetection] 🚨 BOT DETECTION LIKELY!', {
          confidence,
          url,
          indicators: indicators.length,
        });
        this.emit('bot-detected', result);
      } else {
        logger.debug('[BotDetection] ✅ No bot detection (safe)', { confidence, url });
      }

      return result;
    } catch (error) {
      logger.error('[BotDetection] Error checking page:', error);
      return {
        detected: false,
        confidence: 0,
        indicators: [],
        timestamp: new Date(),
        url,
      };
    }
  }

  /**
   * Detect CAPTCHA on page (reCAPTCHA, hCaptcha, CloudFlare Turnstile)
   */
  private async detectCaptcha(page: Page): Promise<BotDetectionIndicator[]> {
    const indicators: BotDetectionIndicator[] = [];

    try {
      // Check for various CAPTCHA types
      const captchaSelectors = [
        'iframe[src*="recaptcha"]',
        'iframe[src*="hcaptcha"]',
        'iframe[src*="captcha"]',
        '.g-recaptcha',
        '.h-captcha',
        '[data-sitekey]',
        '#cf-challenge-running', // CloudFlare
        '.cf-browser-verification', // CloudFlare
      ];

      for (const selector of captchaSelectors) {
        const element = await page.$(selector);
        if (element) {
          indicators.push({
            type: 'captcha',
            severity: 'critical',
            evidence: `CAPTCHA detected: ${selector}`,
            selector,
          });
        }
      }

      // Check page text for CAPTCHA keywords
      const bodyText = await page.evaluate(() => document.body.textContent || '').catch(() => '');
      const captchaKeywords = [
        'verify you are human',
        'prove you are not a robot',
        'captcha',
        'please complete the security check',
        'unusual traffic from your network',
      ];

      for (const keyword of captchaKeywords) {
        if (bodyText.toLowerCase().includes(keyword)) {
          indicators.push({
            type: 'captcha',
            severity: 'critical',
            evidence: `CAPTCHA keyword found: "${keyword}"`,
          });
        }
      }
    } catch (error) {
      logger.debug('[BotDetection] Error detecting CAPTCHA:', error);
    }

    return indicators;
  }

  /**
   * Detect "Access Denied" / "Blocked" pages
   */
  private async detectBlockedPage(page: Page): Promise<BotDetectionIndicator[]> {
    const indicators: BotDetectionIndicator[] = [];

    try {
      const title = await page.title();
      const bodyText = await page.evaluate(() => document.body.textContent || '').catch(() => '');

      const blockedKeywords = [
        'access denied',
        'forbidden',
        '403',
        'blocked',
        'not authorized',
        'request blocked',
        'access to this page has been denied',
        'you have been blocked',
        'security check',
      ];

      // Check title
      for (const keyword of blockedKeywords) {
        if (title.toLowerCase().includes(keyword)) {
          indicators.push({
            type: 'blocked',
            severity: 'critical',
            evidence: `Blocked page title: "${title}"`,
          });
        }
      }

      // Check body text
      for (const keyword of blockedKeywords) {
        if (bodyText.toLowerCase().includes(keyword)) {
          indicators.push({
            type: 'blocked',
            severity: 'high',
            evidence: `Blocked keyword found: "${keyword}"`,
          });
        }
      }

      // Check HTTP status (if available)
      const response = await page.goto(page.url(), { waitUntil: 'domcontentloaded', timeout: 1000 }).catch(() => null);
      if (response && response.status() === 403) {
        indicators.push({
          type: 'blocked',
          severity: 'critical',
          evidence: 'HTTP 403 Forbidden',
        });
      }
    } catch (error) {
      logger.debug('[BotDetection] Error detecting blocked page:', error);
    }

    return indicators;
  }

  /**
   * Detect CloudFlare/Akamai challenges
   */
  private async detectChallenges(page: Page): Promise<BotDetectionIndicator[]> {
    const indicators: BotDetectionIndicator[] = [];

    try {
      const bodyText = await page.evaluate(() => document.body.textContent || '').catch(() => '');
      const title = await page.title();

      // CloudFlare challenge
      const cloudflareSelectors = [
        '#cf-challenge-running',
        '.cf-browser-verification',
        '#challenge-form',
      ];

      for (const selector of cloudflareSelectors) {
        const element = await page.$(selector);
        if (element) {
          indicators.push({
            type: 'challenge',
            severity: 'critical',
            evidence: `CloudFlare challenge detected: ${selector}`,
            selector,
          });
        }
      }

      // Check for CloudFlare in title/body
      if (title.toLowerCase().includes('cloudflare') || bodyText.toLowerCase().includes('cloudflare')) {
        if (bodyText.toLowerCase().includes('checking your browser')) {
          indicators.push({
            type: 'challenge',
            severity: 'high',
            evidence: 'CloudFlare "Checking your browser" challenge',
          });
        }
      }

      // Akamai challenge
      if (bodyText.toLowerCase().includes('akamai') && bodyText.toLowerCase().includes('robot')) {
        indicators.push({
          type: 'challenge',
          severity: 'high',
          evidence: 'Akamai bot challenge detected',
        });
      }
    } catch (error) {
      logger.debug('[BotDetection] Error detecting challenges:', error);
    }

    return indicators;
  }

  /**
   * Detect rate-limiting warnings
   */
  private async detectRateLimiting(page: Page): Promise<BotDetectionIndicator[]> {
    const indicators: BotDetectionIndicator[] = [];

    try {
      const bodyText = await page.evaluate(() => document.body.textContent || '').catch(() => '');

      const rateLimitKeywords = [
        'too many requests',
        'rate limit',
        'slow down',
        'try again later',
        'temporarily blocked',
        '429',
      ];

      for (const keyword of rateLimitKeywords) {
        if (bodyText.toLowerCase().includes(keyword)) {
          indicators.push({
            type: 'rate-limit',
            severity: 'high',
            evidence: `Rate limit keyword: "${keyword}"`,
          });
        }
      }
    } catch (error) {
      logger.debug('[BotDetection] Error detecting rate limits:', error);
    }

    return indicators;
  }

  /**
   * Detect suspicious redirects (e.g., to bot-check pages)
   */
  private async detectSuspiciousRedirects(page: Page): Promise<BotDetectionIndicator[]> {
    const indicators: BotDetectionIndicator[] = [];

    try {
      const url = page.url();

      const suspiciousUrlPatterns = [
        '/captcha',
        '/bot-check',
        '/security-check',
        '/verify',
        '/challenge',
        '/blocked',
        '/cdn-cgi/challenge',
      ];

      for (const pattern of suspiciousUrlPatterns) {
        if (url.toLowerCase().includes(pattern)) {
          indicators.push({
            type: 'redirect',
            severity: 'high',
            evidence: `Suspicious redirect to: ${url}`,
          });
        }
      }
    } catch (error) {
      logger.debug('[BotDetection] Error detecting redirects:', error);
    }

    return indicators;
  }

  /**
   * Detect anti-bot JavaScript (fingerprinting attempts, etc.)
   */
  private async detectAntiBotJS(page: Page): Promise<BotDetectionIndicator[]> {
    const indicators: BotDetectionIndicator[] = [];

    try {
      // Check for common anti-bot JS libraries
      const antiBotLibraries = await page.evaluate(() => {
        const detected: string[] = [];

        // Check for PerimeterX
        if ((window as any)._px || (window as any).PX) {
          detected.push('PerimeterX');
        }

        // Check for DataDome
        if ((window as any).datadome || (window as any).DD) {
          detected.push('DataDome');
        }

        // Check for Shape Security
        if ((window as any).shape || (window as any)._sp_) {
          detected.push('Shape Security');
        }

        // Check for Kasada
        if ((window as any).kasada || document.querySelector('script[src*="kasada"]')) {
          detected.push('Kasada');
        }

        // Check for Imperva/Incapsula
        if ((window as any).incap || document.querySelector('script[src*="incapsula"]')) {
          detected.push('Imperva/Incapsula');
        }

        return detected;
      });

      for (const library of antiBotLibraries) {
        indicators.push({
          type: 'suspicious-js',
          severity: 'medium',
          evidence: `Anti-bot library detected: ${library}`,
        });
      }
    } catch (error) {
      logger.debug('[BotDetection] Error detecting anti-bot JS:', error);
    }

    return indicators;
  }

  /**
   * Calculate confidence that we've been detected
   */
  private calculateConfidence(indicators: BotDetectionIndicator[]): number {
    if (indicators.length === 0) {
      return 0;
    }

    let score = 0;

    for (const indicator of indicators) {
      // Weight by severity
      switch (indicator.severity) {
        case 'critical':
          score += 50; // CAPTCHA, Blocked = instant high confidence
          break;
        case 'high':
          score += 30;
          break;
        case 'medium':
          score += 15;
          break;
        case 'low':
          score += 5;
          break;
      }

      // Weight by type (CAPTCHA is the strongest signal)
      if (indicator.type === 'captcha') {
        score += 25; // Extra weight for CAPTCHA
      }
    }

    // Cap at 100
    return Math.min(100, score);
  }

  /**
   * Start monitoring page (listen for navigation and check automatically)
   */
  async startMonitoring(page: Page): Promise<void> {
    logger.info('[BotDetection] 🔍 Starting automatic bot-detection monitoring');

    // Check on every navigation
    page.on('framenavigated', async (frame) => {
      if (frame === page.mainFrame()) {
        logger.debug('[BotDetection] Navigation detected, checking for bot detection...');
        await this.checkPage(page);
      }
    });

    // Initial check
    await this.checkPage(page);
  }
}

// Export singleton
export const botDetectionService = new BotDetectionService();
