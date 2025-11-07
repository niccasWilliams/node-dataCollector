# 📡 API Updates - Safety Features

## Neue Features in der Browser-API (2025-01-06)

Die Browser-API wurde mit zwei kritischen Sicherheits-Features erweitert:
1. **Bot-Detection-Detection** 🚨
2. **Persistent Browser Profiles** 🔐

---

## Updated Endpoint: `POST /browser/session`

### Neue Config-Optionen

#### 1. Stealth-Options (bereits vorhanden, jetzt dokumentiert)

```json
{
  "config": {
    "useStealth": true,  // DEFAULT: true - EMPFOHLEN!
    "extensions": ["path/to/extension"],  // Optional
    "proxy": {
      "server": "http://proxy.example.com:8080",
      "username": "user",
      "password": "pass"
    }
  }
}
```

#### 2. Bot-Detection-Options (NEU! 🚨)

```json
{
  "config": {
    "botDetection": true,  // DEFAULT: true
    "onBotDetected": "warn"  // "warn" | "stop" | "ignore"
  }
}
```

**Was macht `botDetection`?**
- Prüft **automatisch** jede Seite nach Bot-Detection-Indikatoren
- Erkennt: CAPTCHA, "Access Denied", CloudFlare Challenges, Rate-Limiting, etc.
- Gibt Confidence-Score (0-100%)

**`onBotDetected` Optionen:**
- `"warn"` (default): Warnung loggen, weitermachen
- `"stop"`: Session sofort schließen bei Detection
- `"ignore"`: Nicht prüfen (nicht empfohlen!)

#### 3. Persistent Profiles (NEU! 🔐)

```json
{
  "config": {
    "persistProfile": "onlogist"  // string | boolean
  }
}
```

**Optionen:**
- `true`: Auto-erstellt Profil
- `"profile-name"`: Verwendet spezifisches Profil (z.B. "onlogist", "amazon")
- `false` / nicht angegeben: Temporäre Session (default)

**Was bringt das?**
- Cookies/LocalStorage bleiben erhalten
- Login nur **1x** nötig!
- Wie ein echter Nutzer!

---

## Beispiele

### 1. Maximum Safety für Onlogist

```bash
curl -X POST http://localhost:3000/browser/session \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "persistProfile": "onlogist",
      "botDetection": true,
      "onBotDetected": "stop",
      "proxy": {
        "server": "http://proxy.example.com:8080"
      }
    }
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "stealth-1704537600000-abc123",
    "status": "idle",
    "currentUrl": null,
    "title": null,
    "createdAt": "2025-01-06T12:00:00.000Z"
  }
}
```

### 2. Standard-Session (Stealth + Bot-Detection aktiv)

```bash
curl -X POST http://localhost:3000/browser/session \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Default-Config:**
```json
{
  "useStealth": true,
  "botDetection": true,
  "onBotDetected": "warn",
  "persistProfile": false
}
```

### 3. Temporäre Session ohne Bot-Detection (NICHT empfohlen!)

```bash
curl -X POST http://localhost:3000/browser/session \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "botDetection": false
    }
  }'
```

---

## Neue (geplante) Endpoints

Die folgenden Endpoints sind in der OpenAPI-Dokumentation definiert, aber noch **nicht implementiert**.
Sie sind als Kommentare in `browser.route.ts` hinterlegt und können bei Bedarf implementiert werden:

### 1. Bot-Detection prüfen

```
POST /browser/session/{sessionId}/check-bot-detection
```

**Response-Beispiel:**
```json
{
  "success": true,
  "data": {
    "detected": true,
    "confidence": 75,
    "indicators": [
      {
        "type": "captcha",
        "severity": "critical",
        "evidence": "CAPTCHA detected: iframe[src*=\"recaptcha\"]",
        "selector": "iframe[src*=\"recaptcha\"]"
      },
      {
        "type": "challenge",
        "severity": "high",
        "evidence": "CloudFlare \"Checking your browser\" challenge"
      }
    ],
    "timestamp": "2025-01-06T12:05:00.000Z",
    "url": "https://example.com"
  }
}
```

### 2. Profile verwalten

```
GET /browser/profiles                      # Alle Profile abrufen
DELETE /browser/profiles/{profileName}     # Profil löschen
POST /browser/profiles/cleanup             # Alte Profile aufräumen
```

**GET /browser/profiles Response:**
```json
{
  "success": true,
  "data": [
    {
      "name": "onlogist",
      "path": "/Users/.../.node-datacollector/browser-profiles/onlogist",
      "website": "onlogist.com",
      "createdAt": "2025-01-06T10:00:00.000Z",
      "lastUsedAt": "2025-01-06T12:00:00.000Z"
    },
    {
      "name": "amazon",
      "path": "/Users/.../.node-datacollector/browser-profiles/amazon",
      "website": "amazon.de",
      "createdAt": "2025-01-05T14:00:00.000Z",
      "lastUsedAt": "2025-01-06T09:00:00.000Z"
    }
  ]
}
```

---

## Workflow-Beispiel: Onlogist Scraping

### Schritt 1: Erste Session (Login)

```bash
# Session erstellen
curl -X POST http://localhost:3000/browser/session \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "persistProfile": "onlogist",
      "onBotDetected": "stop"
    }
  }'

# Response: { "data": { "id": "stealth-123..." } }

# Zu Onlogist navigieren
curl -X POST http://localhost:3000/browser/session/stealth-123.../navigate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://onlogist.com"
  }'

# Login durchführen (mit Onlogist-Service oder manuell)
# ...

# Session schließen
curl -X DELETE http://localhost:3000/browser/session/stealth-123...
```

### Schritt 2: Nächste Session (kein Login nötig!)

```bash
# Neue Session mit GLEICHEM Profil
curl -X POST http://localhost:3000/browser/session \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "persistProfile": "onlogist"
    }
  }'

# Zu Onlogist navigieren
curl -X POST http://localhost:3000/browser/session/stealth-456.../navigate \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://onlogist.com"
  }'

# ✅ BEREITS ANGEMELDET! Kein Login nötig!
```

---

## Breaking Changes

**KEINE!** 🎉

Alle neuen Features sind:
- Opt-in (außer Stealth & Bot-Detection, die sind default-on)
- Backward-kompatibel
- Bestehende APIs funktionieren unverändert

---

## Migration Guide

### Von `BrowserService` zu `BrowserHandler` (empfohlen)

**Alt (deprecated):**
```typescript
import { BrowserService } from '@/services/browser';
const service = new BrowserService({ headless: false });
await service.initialize();
```

**Neu:**
```typescript
import { browserHandler } from '@/services/browser';
const session = await browserHandler.createSession({
  headless: false,
  persistProfile: 'my-profile',  // Optional: persistent profile
  onBotDetected: 'warn',         // Optional: bot-detection handling
});
```

---

## OpenAPI-Dokumentation

Die vollständige OpenAPI-Dokumentation ist verfügbar unter:
- **Swagger UI:** `http://localhost:3000/api-docs`
- **JSON:** `http://localhost:3000/api-docs.json`

### Neue Sections:
1. **Safety Features** - Bot-Detection & Persistent Profiles
2. **Updated:** Browser Automation - Erweiterte Config-Optionen

---

## Weitere Informationen

- **Implementierungs-Details:** `SAFETY-FEATURES-GUIDE.md`
- **Service-Dokumentation:** `src/services/browser/bot-detection.service.ts`
- **Service-Dokumentation:** `src/services/browser/user-data.service.ts`
- **Type-Definitionen:** `src/types/browser.types.ts`

---

**Letzte Aktualisierung:** 2025-01-06
**Version:** 2.0 (Safety Edition)
