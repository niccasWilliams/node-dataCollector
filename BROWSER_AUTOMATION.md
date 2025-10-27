# Browser Automation mit Playwright

Diese App verfügt jetzt über eine vollständige Browser-Automatisierung mit **Playwright** und **echtem Chrome**.

## Features

- ✅ **Echter Chrome** - Verwendet deine installierte Chrome-Installation, kein Chromium
- ✅ **Anti-Detection** - Sieht aus wie ein echter Benutzer (navigator.webdriver entfernt, etc.)
- ✅ **Session Management** - Mehrere Browser-Sessions gleichzeitig
- ✅ **Screenshots** - Volle Seite oder Viewport
- ✅ **Navigation** - Vor, zurück, neu laden
- ✅ **Interaktion** - Klicken, Tippen, Auswählen, Scrollen
- ✅ **Datenextraktion** - JavaScript ausführen und Daten extrahieren
- ✅ **REST API** - Volle API-Steuerung
- ✅ **Datenbank-Logging** - Alle Sessions und Aktivitäten werden protokolliert

## Installation

Playwright ist bereits installiert. Du musst nur noch die Datenbank migrieren:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

## API Endpoints

Alle Endpoints sind unter `/browser` verfügbar.

### Session Management

#### Neue Session erstellen
```bash
POST /browser/session
```

**Body:**
```json
{
  "config": {
    "headless": false,
    "slowMo": 100,
    "viewport": {
      "width": 1920,
      "height": 1080
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "browser-1234567890-abc123",
    "status": "idle",
    "currentUrl": null,
    "title": null,
    "createdAt": "2025-01-27T10:00:00.000Z",
    "lastActivityAt": "2025-01-27T10:00:00.000Z"
  }
}
```

#### Session-Info abrufen
```bash
GET /browser/session/:sessionId
```

#### Alle Sessions abrufen
```bash
GET /browser/sessions
```

#### Session schließen
```bash
DELETE /browser/session/:sessionId
```

### Navigation

#### Zu URL navigieren
```bash
POST /browser/session/:sessionId/navigate
```

**Body:**
```json
{
  "url": "https://onlogist.com",
  "options": {
    "waitUntil": "networkidle",
    "timeout": 30000
  }
}
```

#### Zurück
```bash
POST /browser/session/:sessionId/back
```

#### Vorwärts
```bash
POST /browser/session/:sessionId/forward
```

#### Neu laden
```bash
POST /browser/session/:sessionId/reload
```

### Screenshots

#### Screenshot erstellen
```bash
POST /browser/session/:sessionId/screenshot
```

**Body:**
```json
{
  "fullPage": true,
  "type": "png",
  "quality": 90
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "path": "/pfad/zum/screenshot.png",
    "filename": "screenshot-browser-123-1234567890.png",
    "size": 123456,
    "url": "/browser/screenshots/screenshot-browser-123-1234567890.png"
  }
}
```

#### Screenshot abrufen
```bash
GET /browser/screenshots/:filename
```

### Seiteninteraktion

#### Element klicken
```bash
POST /browser/session/:sessionId/click
```

**Body:**
```json
{
  "selector": "button.login"
}
```

#### Text eingeben
```bash
POST /browser/session/:sessionId/type
```

**Body:**
```json
{
  "selector": "input[name='username']",
  "text": "mein-username"
}
```

#### Option auswählen
```bash
POST /browser/session/:sessionId/select
```

**Body:**
```json
{
  "selector": "select#country",
  "value": "DE"
}
```

#### Über Element hovern
```bash
POST /browser/session/:sessionId/hover
```

**Body:**
```json
{
  "selector": ".menu-item"
}
```

#### Scrollen
```bash
POST /browser/session/:sessionId/scroll
```

**Body:**
```json
{
  "x": 0,
  "y": 500
}
```

#### Auf Element warten
```bash
POST /browser/session/:sessionId/wait
```

**Body:**
```json
{
  "selector": ".dynamic-content",
  "options": {
    "timeout": 5000,
    "state": "visible"
  }
}
```

### Seiteninformationen

#### Seiteninfo abrufen
```bash
GET /browser/session/:sessionId/info
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "title": "Example Domain",
    "cookies": [...],
    "localStorage": {...}
  }
}
```

#### HTML abrufen
```bash
GET /browser/session/:sessionId/html
```

#### JavaScript ausführen
```bash
POST /browser/session/:sessionId/evaluate
```

**Body:**
```json
{
  "script": "() => { return document.querySelectorAll('.product').length; }"
}
```

### Helper-Endpoints

#### Navigieren und auf Element warten
```bash
POST /browser/session/:sessionId/navigate-and-wait
```

**Body:**
```json
{
  "url": "https://onlogist.com",
  "selector": "#route-table",
  "options": {
    "timeout": 10000
  }
}
```

#### Formular ausfüllen und absenden
```bash
POST /browser/session/:sessionId/fill-form
```

**Body:**
```json
{
  "fields": [
    {
      "selector": "input[name='username']",
      "value": "mein-username"
    },
    {
      "selector": "input[name='password']",
      "value": "mein-passwort"
    }
  ],
  "submitSelector": "button[type='submit']"
}
```

## Code-Beispiele

### TypeScript/JavaScript (direkt im Code)

```typescript
import { browserController } from './services/browser';

// Session erstellen
const session = await browserController.createSession({
  headless: false,
  slowMo: 100,
});

console.log('Session ID:', session.id);

// Navigieren
await browserController.navigate(session.id, 'https://onlogist.com');

// Auf Element warten
await browserController.waitForSelector(session.id, '#route-table');

// Screenshot
const screenshot = await browserController.screenshot(session.id, {
  fullPage: true,
});

// Daten extrahieren
const routes = await browserController.evaluate(session.id, () => {
  const rows = Array.from(document.querySelectorAll('#route-table tr'));
  return rows.map(row => {
    const cells = row.querySelectorAll('td');
    return {
      from: cells[0]?.textContent,
      to: cells[1]?.textContent,
      distance: cells[2]?.textContent,
    };
  });
});

console.log('Gefundene Routen:', routes);

// Session schließen
await browserController.closeSession(session.id);
```

### cURL (API-Aufruf)

```bash
# Session erstellen
SESSION_ID=$(curl -X POST http://localhost:3000/browser/session \
  -H "Content-Type: application/json" \
  -d '{"config":{"headless":false}}' \
  | jq -r '.data.id')

echo "Session ID: $SESSION_ID"

# Navigieren
curl -X POST http://localhost:3000/browser/session/$SESSION_ID/navigate \
  -H "Content-Type: application/json" \
  -d '{"url":"https://onlogist.com"}'

# Screenshot
curl -X POST http://localhost:3000/browser/session/$SESSION_ID/screenshot \
  -H "Content-Type: application/json" \
  -d '{"fullPage":true}' \
  | jq '.data.url'

# Session schließen
curl -X DELETE http://localhost:3000/browser/session/$SESSION_ID
```

## Verwendung für Onlogist-Daten

Beispiel: Routen von Onlogist abrufen

```typescript
// Session erstellen
const session = await browserController.createSession();

// Zu Onlogist navigieren und auf Login-Formular warten
await browserController.navigateAndWait(
  session.id,
  'https://onlogist.com/login',
  'input[name="email"]'
);

// Login-Formular ausfüllen
await browserController.fillAndSubmit(
  session.id,
  [
    { selector: 'input[name="email"]', value: 'deine@email.de' },
    { selector: 'input[name="password"]', value: 'dein-passwort' },
  ],
  'button[type="submit"]'
);

// Auf Dashboard warten
await browserController.waitForSelector(session.id, '.dashboard');

// Zu Routen navigieren
await browserController.navigate(session.id, 'https://onlogist.com/routes');

// Daten extrahieren
const routes = await browserController.evaluate(session.id, () => {
  // Hier dein Extraktionscode für Onlogist
  return [...]; // Deine extrahierten Daten
});

// In Datenbank speichern (du kannst eine eigene Tabelle erstellen)
// await db.insert(routesTable).values(routes);

// Session schließen
await browserController.closeSession(session.id);
```

## Datenbankschema

Die folgenden Tabellen wurden hinzugefügt:

### `browser_sessions`
Speichert Browser-Sessions

- `id` - Primärschlüssel
- `session_id` - Eindeutige Session-ID
- `user_id` - Optional: Benutzer-ID
- `status` - idle, active, navigating, closed
- `current_url` - Aktuelle URL
- `title` - Seitentitel
- `config` - Browser-Konfiguration (JSON)
- `metadata` - Benutzerdefinierte Metadaten (JSON)
- `created_at` - Erstellungszeitpunkt
- `last_activity_at` - Letzte Aktivität
- `closed_at` - Schließungszeitpunkt

### `browser_activities`
Protokolliert alle Browser-Aktivitäten

- `id` - Primärschlüssel
- `session_id` - Session-ID
- `type` - navigation, screenshot, interaction, script, extraction
- `action` - Aktionsbeschreibung
- `target` - Ziel (URL, Selektor, etc.)
- `value` - Wert (Text, Script, etc.)
- `metadata` - Zusätzliche Daten (JSON)
- `success` - Erfolgreich?
- `error` - Fehlermeldung
- `duration` - Dauer in Millisekunden
- `timestamp` - Zeitstempel

### `browser_screenshots`
Speichert Screenshot-Informationen

- `id` - Primärschlüssel
- `session_id` - Session-ID
- `activity_id` - Aktivitäts-ID
- `url` - URL bei Screenshot
- `title` - Seitentitel
- `path` - Dateipfad
- `full_page` - Ganze Seite?
- `width` / `height` - Abmessungen
- `size` - Dateigröße in Bytes
- `metadata` - Metadaten (JSON)
- `created_at` - Erstellungszeitpunkt

### `browser_extracted_data`
Speichert extrahierte Daten

- `id` - Primärschlüssel
- `session_id` - Session-ID
- `activity_id` - Aktivitäts-ID
- `url` - URL der Datenquelle
- `data_type` - Datentyp (z.B. "onlogist_routes")
- `data` - Extrahierte Daten (JSON)
- `schema` - Optional: Datenschema (JSON)
- `metadata` - Metadaten (JSON)
- `created_at` - Erstellungszeitpunkt

## Anti-Detection Features

Der Browser wird so konfiguriert, dass er wie ein echter Benutzer aussieht:

### Stealth-Features implementiert:

1. **Navigator Properties**
   - ✅ `navigator.webdriver` wird komplett entfernt
   - ✅ Webdriver-Property aus Navigator.prototype gelöscht
   - ✅ Realistische `navigator.languages`: ['de-DE', 'de', 'en-US', 'en']
   - ✅ Platform: 'Linux x86_64'
   - ✅ Hardware: 8 CPU-Kerne, 8GB RAM

2. **Chrome-Objekt**
   - ✅ Vollständiges `window.chrome` Objekt mit runtime, app, csi, loadTimes
   - ✅ Alle Chrome-spezifischen APIs simuliert
   - ✅ PlatformOs, PlatformArch, PlatformNaclArch

3. **Plugins & Extensions**
   - ✅ Chrome PDF Plugin
   - ✅ Chrome PDF Viewer
   - ✅ Native Client
   - ✅ Realistische Plugin-Metadaten

4. **Permissions API**
   - ✅ Überschrieben für realistische Responses
   - ✅ Notifications-Permission korrekt simuliert

5. **Canvas & WebGL Fingerprinting**
   - ✅ Canvas Fingerprinting mit Noise-Protection
   - ✅ WebGL-Parameter geben realistische GPU-Infos zurück
   - ✅ Intel Iris OpenGL Engine simuliert

6. **Device APIs**
   - ✅ Battery API (charging: true, level: 1)
   - ✅ Connection API (4G, 50ms RTT, 10Mbps downlink)
   - ✅ Screen Properties (1920x1080, 24-bit Farbe)

7. **Function.toString Protection**
   - ✅ toString-Calls geben "[native code]" zurück
   - ✅ Verhindert Detection durch Function-Inspizierung

8. **Chrome Launch Args**
   - ✅ `--disable-blink-features=AutomationControlled`
   - ✅ `--disable-infobars`
   - ✅ Alle Automation-Indicators deaktiviert
   - ✅ Realistische Browser-Flags

9. **Lokalisierung**
   - ✅ Deutsche Locale (de-DE)
   - ✅ Zeitzone: Europe/Berlin
   - ✅ User-Agent: Chrome 131 auf Linux
   - ✅ SlowMo: 100ms Verzögerung für menschliches Verhalten

## Sicherheitshinweise

- Der Browser läuft **lokal** auf deinem System
- Keine Daten werden an externe Server gesendet
- Screenshots werden in `storage/screenshots/` gespeichert
- Sessions werden in der Datenbank protokolliert
- Du kannst sensible Daten in `.env` speichern

## Nächste Schritte

1. **Migration ausführen**: `pnpm drizzle-kit generate && pnpm drizzle-kit migrate`
2. **Server starten**: `pnpm dev`
3. **Erste Session testen**: Verwende die API-Beispiele oben
4. **Onlogist-Integration**: Erstelle einen Service für Onlogist-Datenextraktion

## Support

Bei Fragen oder Problemen kannst du:
- Die Logs in der Datenbank überprüfen (`browser_activities`)
- Die Console-Events im Terminal beobachten
- Screenshots zur Fehlersuche verwenden
