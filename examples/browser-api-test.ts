/**
 * Browser API Test Script
 *
 * Testet die REST API für Browser-Automatisierung
 * Stelle sicher, dass der Server läuft (npm run run:dev)
 */

import axios from 'axios';

const API_BASE = 'http://localhost:3000/browser'; // Passe den Port an

interface BrowserSession {
  id: string;
  status: 'idle' | 'active' | 'navigating' | 'closed';
  currentUrl: string | null;
  title: string | null;
  createdAt: string;
  lastActivityAt: string;
}

async function testBrowserAPI() {
  console.log('🚀 Teste Browser-Automatisierung API...\n');

  let sessionId: string | null = null;

  try {
    // Test 1: Create browser session
    console.log('Test 1: Browser-Session erstellen...');
    const createResponse = await axios.post<{ success: boolean; data: BrowserSession }>(
      `${API_BASE}/session`,
      {
        config: {
          headless: false,
          slowMo: 100,
        },
      }
    );
    sessionId = createResponse.data.data.id;
    console.log('✅ Session erstellt:', sessionId);
    console.log('   Status:', createResponse.data.data.status);
    console.log();

    // Test 2: Navigate to URL
    console.log('Test 2: Zu URL navigieren...');
    await axios.post(`${API_BASE}/session/${sessionId}/navigate`, {
      url: 'https://www.google.de',
      options: {
        waitUntil: 'networkidle',
      },
    });
    console.log('✅ Navigation erfolgreich\n');

    await sleep(2000);

    // Test 3: Get page info
    console.log('Test 3: Seiteninformationen abrufen...');
    const infoResponse = await axios.get(`${API_BASE}/session/${sessionId}/info`);
    console.log('✅ Seiten-Info:');
    console.log('   Titel:', infoResponse.data.data.title);
    console.log('   URL:', infoResponse.data.data.url);
    console.log('   Cookies:', infoResponse.data.data.cookies?.length || 0);
    console.log();

    // Test 4: Take screenshot
    console.log('Test 4: Screenshot erstellen...');
    const screenshotResponse = await axios.post(
      `${API_BASE}/session/${sessionId}/screenshot`,
      {
        fullPage: false,
        type: 'png',
      }
    );
    console.log('✅ Screenshot gespeichert:');
    console.log('   Dateiname:', screenshotResponse.data.data.filename);
    console.log('   Größe:', (screenshotResponse.data.data.size / 1024).toFixed(2), 'KB');
    console.log('   URL:', screenshotResponse.data.data.url);
    console.log();

    // Test 5: Type into search box
    console.log('Test 5: Text eingeben...');
    try {
      await axios.post(`${API_BASE}/session/${sessionId}/wait`, {
        selector: 'textarea[name="q"]',
        options: { timeout: 5000 },
      });

      await axios.post(`${API_BASE}/session/${sessionId}/type`, {
        selector: 'textarea[name="q"]',
        text: 'Playwright Stealth Browser',
      });
      console.log('✅ Text eingegeben\n');

      await sleep(2000);
    } catch (error) {
      console.log('⚠️  Interaktion übersprungen (Google-Layout kann variieren)\n');
    }

    // Test 6: Execute JavaScript
    console.log('Test 6: JavaScript ausführen...');
    const evalResponse = await axios.post(`${API_BASE}/session/${sessionId}/evaluate`, {
      script: `() => {
        return {
          url: window.location.href,
          title: document.title,
          hasWebdriver: navigator.webdriver !== undefined,
          hasChrome: !!(window.chrome && window.chrome.runtime),
          userAgent: navigator.userAgent,
          viewport: {
            width: window.innerWidth,
            height: window.innerHeight
          }
        };
      }`,
    });
    console.log('✅ JavaScript Ergebnis:');
    console.log('   URL:', evalResponse.data.data.url);
    console.log('   Titel:', evalResponse.data.data.title);
    console.log('   Webdriver erkannt:', evalResponse.data.data.hasWebdriver ? '❌ JA' : '✅ NEIN');
    console.log('   Chrome-Objekt:', evalResponse.data.data.hasChrome ? '✅ JA' : '❌ NEIN');
    console.log('   Viewport:', evalResponse.data.data.viewport);
    console.log();

    // Test 7: Get all sessions
    console.log('Test 7: Alle Sessions abrufen...');
    const sessionsResponse = await axios.get(`${API_BASE}/sessions`);
    console.log('✅ Aktive Sessions:', sessionsResponse.data.data.length);
    console.log();

    // Test 8: Navigation controls
    console.log('Test 8: Navigation-Controls...');
    console.log('   Zurück...');
    await axios.post(`${API_BASE}/session/${sessionId}/back`);
    await sleep(1500);

    console.log('   Vorwärts...');
    await axios.post(`${API_BASE}/session/${sessionId}/forward`);
    await sleep(1500);

    console.log('   Neu laden...');
    await axios.post(`${API_BASE}/session/${sessionId}/reload`);
    await sleep(1500);
    console.log('✅ Navigation-Controls funktionieren\n');

    // Test 9: Get session info
    console.log('Test 9: Session-Info abrufen...');
    const sessionResponse = await axios.get(`${API_BASE}/session/${sessionId}`);
    console.log('✅ Session-Info:');
    console.log('   ID:', sessionResponse.data.data.id);
    console.log('   Status:', sessionResponse.data.data.status);
    console.log('   Aktuelle URL:', sessionResponse.data.data.currentUrl);
    console.log('   Titel:', sessionResponse.data.data.title);
    console.log();

    console.log('⏳ Browser bleibt 10 Sekunden offen zur Inspektion...');
    await sleep(10000);

    console.log('\n✅ Alle API-Tests erfolgreich abgeschlossen!');

  } catch (error: any) {
    console.error('\n❌ Fehler beim API-Test:', error.response?.data || error.message);
  } finally {
    // Cleanup
    if (sessionId) {
      console.log('\n🧹 Schließe Browser-Session...');
      try {
        await axios.delete(`${API_BASE}/session/${sessionId}`);
        console.log('✅ Session geschlossen');
      } catch (error) {
        console.log('⚠️  Session konnte nicht geschlossen werden');
      }
    }
    console.log('\n✅ Test beendet.\n');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Run test
testBrowserAPI().catch(console.error);
