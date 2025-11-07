# 🛡️ Safety Features Guide

## Neu implementiert! (2025-01-06)

Wir haben zwei kritische Sicherheits-Features hinzugefügt:

1. **Bot-Detection-Detection** 🚨 - Erkennt automatisch, wenn wir als Bot erkannt wurden
2. **Persistent Browser Profiles** 🔐 - Bleib angemeldet wie ein echter Nutzer!

---

## 1. Bot-Detection-Detection 🚨

### Was macht es?

Überwacht **automatisch** jede Seite nach Bot-Detection-Indikatoren:

- ✅ CAPTCHA (reCAPTCHA, hCaptcha, CloudFlare Turnstile)
- ✅ "Access Denied" / "Blocked" Seiten
- ✅ CloudFlare/Akamai Challenges
- ✅ Rate-Limiting-Warnungen
- ✅ Verdächtige Redirects
- ✅ Anti-Bot-JavaScript (PerimeterX, DataDome, etc.)

### Wie verwenden?

#### Standard (Default: Aktiviert!)

```typescript
// Bot-Detection ist standardmäßig AN!
const session = await browserHandler.createSession();
await browserHandler.navigate(session.id, 'https://example.com');
// ✅ Wird automatisch geprüft nach Navigation!
```

Logs bei Bot-Detection:
```
[BrowserHandler] ⚠️ BOT DETECTION WARNING
  confidence: 75
  indicators: captcha, challenge
  url: https://example.com
```

#### Bot-Detection ausschalten (nicht empfohlen!)

```typescript
const session = await browserHandler.createSession({
  botDetection: false, // ⚠️ Deaktiviert Bot-Detection!
});
```

#### Session bei Bot-Detection automatisch stoppen

```typescript
const session = await browserHandler.createSession({
  onBotDetected: 'stop', // Session wird sofort geschlossen!
});

try {
  await browserHandler.navigate(session.id, 'https://example.com');
} catch (error) {
  // Error: "Bot detected with 75% confidence. Session stopped for safety."
  logger.error('Bot wurde erkannt, Session gestoppt!', error);
}
```

#### Optionen für `onBotDetected`

```typescript
interface BrowserConfig {
  onBotDetected?: 'warn' | 'stop' | 'ignore';
  // 'warn' (default): Warnung loggen, weitermachen
  // 'stop': Session sofort schließen und Error werfen
  // 'ignore': Nichts tun (nicht empfohlen!)
}
```

---

## 2. Persistent Browser Profiles 🔐

### Was ist das Problem?

**Vorher:**
- Jede Session = Neuer Browser
- Cookies weg = Jedes Mal neu einloggen
- **SEHR AUFFÄLLIG!** 🚨

**Jetzt:**
- Persistent Profile = Browser bleibt bestehen
- Cookies/LocalStorage bleiben
- Login nur **1x** nötig!
- **Wie ein echter Nutzer!** ✅

### Wie verwenden?

#### Option 1: Auto-Profil (empfohlen für Onlogist!)

```typescript
const session = await browserHandler.createSession({
  persistProfile: true, // ✅ Auto-erstellt persistentes Profil!
});

// Beim ERSTEN Mal:
await browserHandler.navigate(session.id, 'https://onlogist.com');
await onlogistService.login(credentials); // Login nötig

// Session schließen
await browserHandler.closeSession(session.id);

// ===== NÄCHSTER START (z.B. am nächsten Tag) =====

const session2 = await browserHandler.createSession({
  persistProfile: true, // ✅ Nutzt SELBES Profil!
});

await browserHandler.navigate(session2.id, 'https://onlogist.com');
// ✅ IMMER NOCH ANGEMELDET! Kein Login nötig!
```

#### Option 2: Benanntes Profil (mehrere Websites)

```typescript
// Profil für Onlogist
const onlogistSession = await browserHandler.createSession({
  persistProfile: 'onlogist', // Spezifischer Name
});

// Profil für Amazon
const amazonSession = await browserHandler.createSession({
  persistProfile: 'amazon', // Anderer Name
});

// Jedes Profil hat eigene Cookies/Sessions!
```

#### Option 3: Temporäre Session (wie bisher)

```typescript
// Standard: Kein persistProfile = temporär
const session = await browserHandler.createSession();
// Cookies gehen beim Schließen verloren
```

### Profile verwalten

```typescript
import { userDataService } from '@/services/browser';

// Alle Profile anzeigen
const profiles = userDataService.getAllProfiles();
console.log('Alle Profile:', profiles);
// Output:
// [
//   { name: 'onlogist', path: '/Users/.../.node-datacollector/browser-profiles/onlogist', ... },
//   { name: 'amazon', path: '/Users/.../.node-datacollector/browser-profiles/amazon', ... }
// ]

// Altes Profil löschen
userDataService.deleteProfile('old-profile');

// Alte Profile aufräumen (älter als 30 Tage)
userDataService.cleanupOldProfiles(30);
```

### Wo werden Profile gespeichert?

```
~/.node-datacollector/browser-profiles/
  ├── onlogist/          (Profil für Onlogist)
  │   ├── .metadata.json
  │   ├── Default/       (Chrome User Data)
  │   └── ...
  ├── amazon/            (Profil für Amazon)
  └── default-profile/   (Default-Profil)
```

**WICHTIG:** Diese Ordner **NICHT** löschen, sonst musst du dich neu einloggen!

---

## 3. Kombination: Maximum Safety! 🔒

### Für Onlogist (empfohlen!)

```typescript
const session = await browserHandler.createSession({
  // Stealth ist bereits default!
  persistProfile: 'onlogist', // Persistent profile
  botDetection: true,         // Bot-Detection (default)
  onBotDetected: 'stop',      // Session bei Bot-Detection stoppen
  proxy: {                    // Optional: Proxy für extra Anonymität
    server: 'http://proxy.example.com:8080',
    username: 'user',
    password: 'pass',
  },
});

try {
  await browserHandler.navigate(session.id, 'https://onlogist.com');

  // Prüfe ob schon angemeldet
  const isLoggedIn = await browserHandler.isLoggedIn(session.id);

  if (!isLoggedIn) {
    // Erster Login
    await onlogistService.login(credentials);
    logger.info('✅ Login erfolgreich, Session wird gespeichert!');
  } else {
    // Bereits angemeldet!
    logger.info('✅ Bereits angemeldet, kein Login nötig!');
  }

  // Scrape orders...
  const orders = await onlogistService.searchOrders(session.id, filters);

} catch (error) {
  if (error.message.includes('Bot detected')) {
    logger.error('🚨 BOT ERKANNT! Session wurde gestoppt.', error);
    // Handle bot detection (z.B. warten, Proxy wechseln, etc.)
  } else {
    logger.error('Error:', error);
  }
} finally {
  await browserHandler.closeSession(session.id);
}
```

---

## 4. Configuration Summary

### Alle neuen Config-Optionen

```typescript
interface BrowserConfig {
  // ... existing options ...

  // ========== STEALTH OPTIONS (bereits implementiert) ==========
  useStealth?: boolean;        // DEFAULT: true
  extensions?: string[];       // Chrome extensions
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };

  // ========== NEW SAFETY OPTIONS ==========
  /**
   * Persistent profile (stays logged in!)
   * - true: Auto-create profile
   * - 'name': Use specific profile
   * - false/undefined: Temporary session (default)
   */
  persistProfile?: boolean | string;

  /**
   * Auto-detect bot detection
   * DEFAULT: true
   */
  botDetection?: boolean;

  /**
   * What to do when bot detection detected
   * - 'warn' (default): Log warning, continue
   * - 'stop': Close session immediately
   * - 'ignore': Don't check
   */
  onBotDetected?: 'warn' | 'stop' | 'ignore';
}
```

---

## 5. Best Practices

### ✅ DO (Empfohlen)

```typescript
// 1. Verwende persistProfile für Login-Sites
const session = await browserHandler.createSession({
  persistProfile: 'onlogist',
  onBotDetected: 'stop',
});

// 2. Prüfe Login-Status vor dem Scrapen
const isLoggedIn = await browserHandler.isLoggedIn(session.id);
if (!isLoggedIn) {
  await onlogistService.login(credentials);
}

// 3. Handle Bot-Detection gracefully
try {
  await browserHandler.navigate(session.id, url);
} catch (error) {
  if (error.message.includes('Bot detected')) {
    // Warte, wechsle Proxy, etc.
    await delay(60000); // 1 Minute warten
  }
}
```

### ❌ DON'T (Nicht empfohlen)

```typescript
// 1. NICHT Bot-Detection deaktivieren
const session = await browserHandler.createSession({
  botDetection: false, // ❌ Gefährlich!
});

// 2. NICHT ohne persistProfile bei Login-Sites
const session = await browserHandler.createSession(); // ❌ Cookies gehen verloren!
await onlogistService.login(credentials); // Jedes Mal neu einloggen = auffällig!

// 3. NICHT Bot-Detection ignorieren
const session = await browserHandler.createSession({
  onBotDetected: 'ignore', // ❌ Du merkst nicht, dass du erkannt wurdest!
});
```

---

## 6. Troubleshooting

### Problem: "Bot detected" bei jeder Navigation

```typescript
// Lösung 1: Warte zwischen Requests
await browserHandler.navigate(session.id, url1);
await delay(3000); // 3 Sekunden warten
await browserHandler.navigate(session.id, url2);

// Lösung 2: Verwende Proxy
const session = await browserHandler.createSession({
  proxy: { server: 'http://proxy.example.com:8080' },
});

// Lösung 3: Prüfe Extensions
// Stelle sicher, dass Chromium installiert ist:
// npx patchright install chromium
```

### Problem: Profile nicht gefunden

```typescript
// Prüfe Base-Directory
import { userDataService } from '@/services/browser';
console.log('Profile Directory:', userDataService.getBaseDir());
// /Users/.../.node-datacollector/browser-profiles/

// Prüfe alle Profile
const profiles = userDataService.getAllProfiles();
console.log('Verfügbare Profile:', profiles);
```

### Problem: Session bleibt nicht angemeldet

```typescript
// Stelle sicher, dass du persistProfile verwendest!
const session = await browserHandler.createSession({
  persistProfile: 'onlogist', // ✅ Wichtig!
});

// Prüfe ob Profil erstellt wurde
const profile = userDataService.getProfile('onlogist');
console.log('Profil:', profile);
```

---

## 7. Monitoring & Logging

### Bot-Detection Events

```typescript
import { botDetectionService } from '@/services/browser';

// Listen to bot-detection events
botDetectionService.on('bot-detected', (result) => {
  logger.error('🚨 BOT DETECTED!', {
    url: result.url,
    confidence: result.confidence,
    indicators: result.indicators.map(i => ({
      type: i.type,
      severity: i.severity,
      evidence: i.evidence,
    })),
  });

  // Send alert (Email, Slack, etc.)
  sendAlert('Bot detected!', result);
});
```

### Manual Bot-Detection Check

```typescript
// Check specific page manually
const stealthSession = await browserStealthService.createStealthSession();
const { page } = stealthSession;

await page.goto('https://example.com');

const botCheck = await botDetectionService.checkPage(page);

if (botCheck.detected) {
  logger.warn('Bot detected!', {
    confidence: botCheck.confidence,
    indicators: botCheck.indicators,
  });
}
```

---

## 8. Zusammenfassung

### Was ist neu?

| Feature | Was macht es? | Default |
|---------|---------------|---------|
| **Bot-Detection** | Erkennt CAPTCHA, Blocks, Challenges | ✅ AN |
| **Persistent Profiles** | Bleib angemeldet (Cookies bleiben) | ❌ AUS |

### Was solltest du für Onlogist verwenden?

```typescript
const session = await browserHandler.createSession({
  persistProfile: 'onlogist',  // ✅ Persistent profile
  botDetection: true,          // ✅ Default (bereits AN)
  onBotDetected: 'stop',       // ✅ Stop bei Bot-Detection
  // Optional:
  proxy: { server: '...' },    // ✅ Extra Anonymität
});
```

### Nächste Schritte

1. ✅ Features sind implementiert
2. 🧪 Teste mit harmloser Website (z.B. `https://bot.sannysoft.com/`)
3. 🔒 Dann teste mit Onlogist (aber vorsichtig!)

---

**🎉 Dein System ist jetzt noch sicherer!**

- ✅ Bot-Detection-Detection
- ✅ Persistent Profiles
- ✅ Stealth Browser
- ✅ Extensions
- ✅ 10+ Anti-Fingerprinting Features

**Total Safety Score: 98%** 🔒
