/**
 * Onlogist Stealth Example
 * SICHERES Beispiel für die Nutzung des Onlogist-Services
 *
 * ⚠️ WICHTIG: IMMER BrowserStealthService verwenden!
 */

import { browserStealthService } from '@/services/browser/browser-stealth.service';
import { onlogistService } from './onlogist.service';
import path from 'path';
import { logger } from '@/utils/logger';
import type { OnlogistSearchFilters } from './onlogist.types';

/**
 * Sicheres Scraping mit MAXIMALER Tarnung
 */
export async function scrapeOnlogistSafely() {
  let sessionId: string | undefined;

  try {
    logger.info('[OnlogistStealth] 🔒 Starting ULTRA-STEALTH Onlogist scraping...');

    // 1. STEALTH-SESSION ERSTELLEN (mit Extension!)
    const session = await browserStealthService.createStealthSession({
      headless: false, // Beim ersten Test: Sichtbar!
      slowMo: 150, // Langsam = Menschlich
      extensions: [
        // KRITISCH: Extension lädt = Browser sieht real aus!
        path.resolve(__dirname, '../../../extensions/dummy-extension'),
      ],
      // Optional: Proxy für zusätzliche Anonymität
      // proxy: {
      //   server: 'http://your-proxy:8080',
      //   username: 'user',
      //   password: 'pass',
      // },
    });

    sessionId = session.id;

    // 2. WARMUP: Simuliere echten Nutzer (optional, aber empfohlen!)
    logger.info('[OnlogistStealth] 🎭 Performing warmup...');
    await warmupBrowser(session);

    // 3. LOGIN
    logger.info('[OnlogistStealth] 🔑 Logging in...');
    const loginSuccess = await onlogistService.login({
      username: process.env.ONLOGIST_USERNAME || '',
      password: process.env.ONLOGIST_PASSWORD || '',
    });

    if (!loginSuccess) {
      throw new Error('Login failed!');
    }

    // WICHTIG: Warte nach Login (echter Nutzer würde auch warten)
    await randomDelay(3000, 7000);

    // 4. SUCHE mit VARIIERENDEN Filtern
    logger.info('[OnlogistStealth] 🔍 Searching orders...');

    const filters: OnlogistSearchFilters = {
      umkreis: 15 + Math.floor(Math.random() * 10), // 15-25km (variiert!)
      startort: "Osnabrück",
      // NICHT immer alle Filter setzen! Variiere!
      ...(Math.random() > 0.5 && { zielort: "Hamm" }),
    };

    const result = await onlogistService.searchOrders(sessionId, filters);

    logger.info(`[OnlogistStealth] ✅ Found ${result.orders.length} orders`);

    // 5. RESULTS VERARBEITEN
    for (const order of result.orders) {
      logger.info(`  📦 ${order.fahrtNr}: ${order.startort} → ${order.zielort} (${order.entfernung}km)`);
    }

    // WICHTIG: Warte vor Logout (real user behavior!)
    await randomDelay(2000, 5000);

    // 6. LOGOUT
    await onlogistService.logout(sessionId);

    logger.info('[OnlogistStealth] ✅ Scraping complete - No detection!');

    return result.orders;
  } catch (error) {
    logger.error('[OnlogistStealth] ❌ ERROR:', error);

    // Check if it's a detection error
    if (error instanceof Error) {
      if (error.message.includes('captcha') || error.message.includes('blocked')) {
        logger.error('[OnlogistStealth] 🚨 POSSIBLE DETECTION! STOP IMMEDIATELY!');
      }
    }

    throw error;
  } finally {
    // IMMER Session schließen
    if (sessionId) {
      try {
        await browserStealthService.closeSession(sessionId);
      } catch (error) {
        logger.error('[OnlogistStealth] Failed to close session:', error);
      }
    }
  }
}

/**
 * Browser-Warmup: Simuliere echten Nutzer
 */
async function warmupBrowser(session: any) {
  const { page } = session;

  // Random mouse movements
  const moves = 2 + Math.floor(Math.random() * 3); // 2-5 moves
  for (let i = 0; i < moves; i++) {
    const x = Math.floor(Math.random() * 800);
    const y = Math.floor(Math.random() * 600);
    await page.mouse.move(x, y, { steps: 10 + Math.floor(Math.random() * 20) });
    await randomDelay(300, 1000);
  }

  // Random scrolling
  if (Math.random() > 0.5) {
    await page.evaluate(() => {
      window.scrollBy({
        top: 100 + Math.random() * 200,
        behavior: 'smooth',
      });
    });
    await randomDelay(500, 1500);
  }
}

/**
 * Zufällige Verzögerung (menschliches Verhalten)
 */
function randomDelay(min: number, max: number): Promise<void> {
  const delay = min + Math.random() * (max - min);
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * PRODUCTION-READY: Periodisches Scraping mit Safety-Checks
 */
export async function scrapeOnlogistPeriodically(intervalMinutes: number = 60) {
  logger.info(`[OnlogistStealth] 🔁 Starting periodic scraping (every ${intervalMinutes} min)`);

  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 3;

  while (true) {
    try {
      // Scrape
      await scrapeOnlogistSafely();

      // Success - reset error counter
      consecutiveErrors = 0;

      // Warte mit VARIATION (nicht immer gleiche Zeit!)
      const jitter = Math.floor(Math.random() * 600000); // ±10 Min
      const waitTime = (intervalMinutes * 60 * 1000) + jitter;

      logger.info(`[OnlogistStealth] ⏰ Next scrape in ${Math.round(waitTime / 60000)} minutes`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

    } catch (error) {
      consecutiveErrors++;

      logger.error(`[OnlogistStealth] ❌ Scraping failed (${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS})`, error);

      // Bei zu vielen Fehlern: STOP
      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        logger.error('[OnlogistStealth] 🚨 TOO MANY ERRORS - STOPPING!');
        throw new Error('Too many consecutive errors - possible detection!');
      }

      // Exponential backoff
      const backoffTime = Math.pow(2, consecutiveErrors) * 60000; // 2^n Minuten
      logger.warn(`[OnlogistStealth] ⏰ Backing off for ${backoffTime / 60000} minutes`);
      await new Promise((resolve) => setTimeout(resolve, backoffTime));
    }
  }
}

// Export für CLI/Testing
if (require.main === module) {
  // ACHTUNG: Nur zu Testzwecken!
  console.log('🔒 Starting Onlogist Stealth Scraper...');
  console.log('⚠️  Make sure you have set ONLOGIST_USERNAME and ONLOGIST_PASSWORD!');
  console.log('');

  scrapeOnlogistSafely()
    .then((orders) => {
      console.log(`\n✅ Success! Found ${orders.length} orders`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed:', error.message);
      process.exit(1);
    });
}
