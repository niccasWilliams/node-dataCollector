/**
 * Browser Automation Test Script
 *
 * Dieses Skript demonstriert die Verwendung des Browser-Services
 * mit einem echten Chrome-Browser für lokale Automatisierung
 */

import { BrowserService } from '../src/services/browser/browser.service';

async function testBrowserAutomation() {
  console.log('🚀 Starte Browser-Automatisierung...\n');

  // Create browser instance
  const browser = new BrowserService({
    headless: false, // Sichtbarer Browser
    slowMo: 150, // Langsamer für bessere Sichtbarkeit
    devtools: false, // Optional: true für DevTools
  });

  // Setup event listeners
  browser.on('session:created', (session) => {
    console.log('✅ Browser-Session erstellt:', session.id);
  });

  browser.on('navigation:start', (data) => {
    console.log('🌐 Navigation startet:', data.url);
  });

  browser.on('navigation:complete', (data) => {
    console.log('✅ Navigation abgeschlossen:', data.title);
  });

  browser.on('page:console', (data) => {
    console.log('📝 Browser Console:', data.type, '-', data.text);
  });

  try {
    // Initialize browser
    console.log('Initialisiere Browser...');
    await browser.initialize();
    console.log('✅ Browser erfolgreich initialisiert!\n');

    // Test 1: Navigate to a website
    console.log('Test 1: Navigation zu einer Webseite...');
    await browser.navigate({
      url: 'https://www.google.de',
      waitUntil: 'networkidle',
    });
    console.log('✅ Navigation erfolgreich!\n');

    // Wait a bit to see the page
    await sleep(2000);

    // Test 2: Get page info
    console.log('Test 2: Seiteninformationen abrufen...');
    const pageInfo = await browser.getPageInfo();
    console.log('Seiten-Titel:', pageInfo.title);
    console.log('Seiten-URL:', pageInfo.url);
    console.log('Anzahl Cookies:', pageInfo.cookies?.length);
    console.log('✅ Seiteninformationen abgerufen!\n');

    // Test 3: Take screenshot
    console.log('Test 3: Screenshot erstellen...');
    const screenshot = await browser.screenshot({
      fullPage: false,
      type: 'png',
      path: './examples/test-screenshot.png',
    });
    console.log('✅ Screenshot gespeichert: ./examples/test-screenshot.png');
    console.log(`   Größe: ${(screenshot.length / 1024).toFixed(2)} KB\n`);

    // Test 4: Interact with search box (Google)
    console.log('Test 4: Mit Suchfeld interagieren...');
    try {
      // Wait for search box
      await browser.waitFor({
        selector: 'textarea[name="q"]',
        timeout: 5000,
      });

      // Type search query
      await browser.interact({
        type: 'type',
        selector: 'textarea[name="q"]',
        value: 'Playwright Browser Automation',
      });
      console.log('✅ Text eingegeben\n');

      await sleep(2000);

      // Submit search
      await browser.interact({
        type: 'type',
        selector: 'textarea[name="q"]',
        value: '\n', // Press Enter
      });
      console.log('✅ Suche abgeschickt\n');

      await sleep(3000);

      // Take another screenshot
      await browser.screenshot({
        fullPage: false,
        type: 'png',
        path: './examples/test-screenshot-search.png',
      });
      console.log('✅ Screenshot der Suchergebnisse gespeichert\n');
    } catch (error) {
      console.log('⚠️  Interaktion übersprungen (Google-Layout kann variieren)');
    }

    // Test 5: Execute custom JavaScript
    console.log('Test 5: JavaScript ausführen...');
    const pageHeight = await browser.evaluate<number>(() => {
      return document.documentElement.scrollHeight;
    });
    console.log('Seitenhöhe:', pageHeight, 'px');

    const userAgent = await browser.evaluate<string>(() => {
      return navigator.userAgent;
    });
    console.log('User Agent:', userAgent);

    // Check if webdriver is detected
    const hasWebdriver = await browser.evaluate<boolean>(() => {
      return (navigator as any).webdriver !== undefined;
    });
    console.log('Webdriver erkannt:', hasWebdriver ? '❌ JA (nicht gut)' : '✅ NEIN (gut!)');

    // Check chrome object
    const hasChrome = await browser.evaluate<boolean>(() => {
      return !!(window as any).chrome && !!(window as any).chrome.runtime;
    });
    console.log('Chrome-Objekt vorhanden:', hasChrome ? '✅ JA' : '❌ NEIN');
    console.log('✅ JavaScript erfolgreich ausgeführt!\n');

    // Test 6: Navigation controls
    console.log('Test 6: Navigation-Controls testen...');
    await sleep(1000);

    console.log('Gehe zurück...');
    await browser.goBack();
    await sleep(2000);

    console.log('Gehe vorwärts...');
    await browser.goForward();
    await sleep(2000);

    console.log('Seite neu laden...');
    await browser.reload();
    await sleep(2000);
    console.log('✅ Navigation-Controls funktionieren!\n');

    // Test 7: Get HTML content
    console.log('Test 7: HTML-Content abrufen...');
    const html = await browser.getHTML();
    console.log(`HTML-Länge: ${html.length} Zeichen`);
    console.log('✅ HTML-Content abgerufen!\n');

    // Final session info
    console.log('📊 Finale Session-Informationen:');
    const session = browser.getSession();
    if (session) {
      console.log('Session ID:', session.id);
      console.log('Status:', session.status);
      console.log('Aktuelle URL:', session.currentUrl);
      console.log('Titel:', session.title);
      console.log('Erstellt:', session.createdAt);
      console.log('Letzte Aktivität:', session.lastActivityAt);
    }

    // Keep browser open for inspection
    console.log('\n⏳ Browser bleibt 10 Sekunden offen zur Inspektion...');
    await sleep(10000);

    console.log('\n✅ Alle Tests erfolgreich abgeschlossen!');

  } catch (error) {
    console.error('\n❌ Fehler beim Test:', error);
  } finally {
    // Cleanup
    console.log('\n🧹 Schließe Browser...');
    await browser.close();
    console.log('✅ Browser geschlossen. Test beendet.\n');
  }
}

// Helper function
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run test
testBrowserAutomation().catch(console.error);
