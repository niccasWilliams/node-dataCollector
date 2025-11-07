# 🔒 Onlogist Security & Anti-Detection Guide

## ⚠️ SEHR WICHTIG - Vor dem ersten Test lesen!

Onlogist.com nutzt wahrscheinlich Bot-Detection. Daher ist **maximale Vorsicht** geboten!

## ✅ Anti-Detection Maßnahmen (Implementiert)

### 1. **Patchright Browser**
- ✅ Verwendet **Patchright** statt Standard-Playwright
- ✅ Patcht CDP (Chrome DevTools Protocol) Leaks automatisch
- ✅ Entfernt `navigator.webdriver` Detection
- ✅ Umgeht Runtime.enable Detection

### 2. **Chrome Extensions** (NEU!)
- ✅ Lädt Dummy-Extension (macht Browser authentischer)
- ✅ Nutzt `launchPersistentContext` (erforderlich für Extensions)
- 📍 Extension-Pfad: `extensions/dummy-extension/`

### 3. **Fingerprint Protection**
- ✅ WebRTC IP Leak Protection
- ✅ Canvas Fingerprinting Protection (Noise-Injection)
- ✅ Audio Context Protection
- ✅ WebGL Fingerprinting Protection
- ✅ Battery API entfernt
- ✅ Hardware Concurrency Randomization
- ✅ Device Memory Spoofing
- ✅ Plugins Spoofing
- ✅ Languages konsistent mit Locale

### 4. **Humanized Interactions**
- ✅ Zufällige Verzögerungen bei Klicks/Typing
- ✅ Realistische Mausbewegungen (Bezier-Kurven)
- ✅ Gelegentliche "Tippfehler"
- ✅ Variable Scroll-Geschwindigkeiten

### 5. **Session Management**
- ✅ Persistente User-Profile (sieht aus wie echter Browser)
- ✅ Cookie-Speicherung zwischen Sessions möglich
- ✅ Separate Sessions pro Scrape (Isolation)

## 🛡️ Nutzung des Stealth-Browsers für Onlogist

**WICHTIG:** Verwende IMMER den `BrowserStealthService` für Onlogist!

```typescript
import { browserStealthService } from '@/services/browser/browser-stealth.service';
import { onlogistService } from '@/services/onlogist';
import path from 'path';

// 1. Stealth-Session erstellen (mit Extension!)
const session = await browserStealthService.createStealthSession({
  headless: false, // Sichtbar zum Testen
  slowMo: 150, // Langsamer = menschlicher
  extensions: [
    path.join(__dirname, '../../../extensions/dummy-extension'),
  ],
});

// 2. Login durchführen
await onlogistService.login({
  username: process.env.ONLOGIST_USERNAME!,
  password: process.env.ONLOGIST_PASSWORD!,
});

// 3. Aufträge scrapen
const result = await onlogistService.searchOrders(session.id, {
  umkreis: 20,
  startort: "Osnabrück",
});

// 4. Session schließen
await browserStealthService.closeSession(session.id);
```

## 🎭 Zusätzliche Sicherheitsmaßnahmen

### Empfohlen:

1. **Proxy nutzen** (optional, aber empfohlen):
   ```typescript
   const session = await browserStealthService.createStealthSession({
     proxy: {
       server: 'http://proxy-server:port',
       username: 'user',
       password: 'pass',
     },
   });
   ```

2. **Zeitverzögerungen** zwischen Aktionen:
   ```typescript
   // NICHT direkt hintereinander scrapen!
   await onlogistService.searchOrders(session.id, filters1);
   await new Promise(r => setTimeout(r, 5000 + Math.random() * 10000)); // 5-15 Sek
   await onlogistService.searchOrders(session.id, filters2);
   ```

3. **Verschiedene Suchfilter** (variieren):
   ```typescript
   // Nicht immer gleiche Filter!
   const filters = {
     umkreis: 15 + Math.floor(Math.random() * 10), // 15-25km
     startort: startOrte[Math.floor(Math.random() * startOrte.length)],
   };
   ```

### Optional (für maximale Paranoia):

4. **Session-Persistenz** (Login speichern):
   ```typescript
   // Beim ersten Login:
   const userDataDir = './chrome-profiles/onlogist-main';
   const session = await browserStealthService.createStealthSession({
     userDataDir, // Speichert Cookies/Login-State
   });
   // Bei nächstem Start: Bereits eingeloggt!
   ```

5. **Manuelle Interaktion simulieren**:
   ```typescript
   // Nach Login: Kurz "herumsurfen"
   await session.page.mouse.move(400 + Math.random() * 200, 300 + Math.random() * 200);
   await session.page.waitForTimeout(2000);
   // Dann erst suchen
   ```

## ❌ NICHT TUN!

1. ❌ **Nicht zu schnell scrapen** (> 1x pro Minute ist verdächtig)
2. ❌ **Nicht headless nutzen** (zumindest beim ersten Test)
3. ❌ **Nicht immer gleiche Filter** (variiere Suchparameter)
4. ❌ **Nicht parallele Sessions** vom gleichen Account
5. ❌ **Nicht ohne Extensions** (Browser ohne Extensions = Bot)
6. ❌ **Nicht Standard-BrowserService** (nutze IMMER BrowserStealthService!)

## 🔍 Testing-Strategie (SICHER!)

### Phase 1: Manueller Test (MACH DAS ZUERST!)
```bash
# Starte Stealth-Browser, aber mache NICHTS automatisch
# Surfe manuell zu onlogist.com und logge dich ein
# Prüfe: Gibt es Warnungen? Captchas? Verdächtige Nachrichten?
```

### Phase 2: Kontrolliertes Scraping
```typescript
// NUR 1-2 Suchvorgänge pro Session!
// Mit langen Pausen (5+ Minuten) zwischen Sessions
```

### Phase 3: Production
```typescript
// Max. 10-20 Scrapes pro Tag
// Zeitlich variiert (nicht immer zur gleichen Zeit!)
// Verschiedene Filter nutzen
```

## 🎯 Checkliste vor erstem Test

- [ ] `BrowserStealthService` statt `BrowserService` nutzen
- [ ] Extension in `extensions/dummy-extension/` vorhanden
- [ ] `headless: false` für ersten Test
- [ ] Credentials in `.env` oder `website_credentials` Tabelle
- [ ] Langsame Geschwindigkeit (`slowMo: 150+`)
- [ ] Keine parallelen Sessions
- [ ] Monitoring aktiviert (Logs beobachten)
- [ ] Notfall-Plan (was tun bei Detection?)

## 🚨 Notfall: Was tun bei Detection?

Wenn Onlogist dich blockiert:

1. **Sofort stoppen** - Keine weiteren Versuche!
2. **IP wechseln** (Proxy, VPN, oder Router-Neustart)
3. **User-Profile löschen** (`rm -rf chrome-profiles/*`)
4. **24h warten**
5. **Langsamere Strategie** (slowMo erhöhen, weniger Scrapes)

## 📊 Detection-Indikatoren

🚨 **SOFORT STOPPEN wenn:**
- Login schlägt mehrmals fehl
- Captcha erscheint
- "Verdächtige Aktivität" Nachricht
- Account temporär gesperrt
- Seite lädt ungewöhnlich langsam

⚠️ **Vorsichtig sein wenn:**
- Seite verhält sich anders als sonst
- Neue Sicherheitsabfragen
- "Bot-Check" oder ähnliche Meldungen

## 💡 Best Practices

1. **Start langsam:** Erst 1-2 Scrapes, dann Pause von Stunden/Tagen
2. **Timing variieren:** Nicht immer zur gleichen Uhrzeit
3. **Realistisches Verhalten:** Simuliere echte Nutzer-Aktionen
4. **Monitoring:** Logge ALLE Aktionen für spätere Analyse
5. **Backup-Account:** Teste NIEMALS mit produktivem Account!

## 🔗 Weitere Ressourcen

- Patchright Docs: https://github.com/Kaliiiiiiiiii-Vinyzu/patchright
- Bot Detection Overview: https://blog.castle.io/anti-detect-frameworks
- WebRTC Leaks testen: https://browserleaks.com/webrtc
- Canvas Fingerprinting: https://browserleaks.com/canvas

---

**REMEMBER:** Langsam ist schnell! Ein erkannter Bot ist nutzlos.
Lieber 5 erfolgreiche Scrapes pro Tag als Account-Sperre.
