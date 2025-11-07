# Chrome Extensions für Browser-Stealth

## Warum Extensions?

**Ein Browser ohne Extensions sieht EXTREM verdächtig aus!**

Echte Nutzer haben fast immer mindestens 1-3 Extensions installiert. Bot-Detection-Systeme prüfen das.

## Empfohlene Extensions (für maximale Tarnung)

### 1. **uBlock Origin** (Ad Blocker)
- **Warum:** 40%+ aller Nutzer haben einen Ad Blocker
- **Download:** https://github.com/gorhill/uBlock/releases
- **Installation:**
  ```bash
  cd extensions/ublock
  # Lade die neueste Version herunter und entpacke hier
  ```

### 2. **Simple Extensions** (unauffällig)
Alternative: Erstelle eine Dummy-Extension

## Extensions installieren

### Option 1: Echte Extension herunterladen

```bash
# Beispiel: uBlock Origin
cd extensions
mkdir ublock
cd ublock
# Download von GitHub und entpacken
```

### Option 2: Dummy-Extension erstellen (EINFACHER!)

Erstelle eine minimale Extension, die nichts tut:

**extensions/dummy-extension/manifest.json:**
```json
{
  "manifest_version": 3,
  "name": "Privacy Helper",
  "version": "1.0.0",
  "description": "Enhanced privacy settings",
  "permissions": [],
  "background": {
    "service_worker": "background.js"
  },
  "icons": {
    "48": "icon.png"
  }
}
```

**extensions/dummy-extension/background.js:**
```javascript
// Minimale Extension die nichts tut
console.log('Privacy Helper loaded');
```

**extensions/dummy-extension/icon.png:**
- Erstelle ein 48x48px Icon oder kopiere eins

## Verwendung im Code

```typescript
import { browserStealthService } from '@/services/browser/browser-stealth.service';

const session = await browserStealthService.createStealthSession({
  headless: false,
  extensions: [
    path.join(__dirname, '../../extensions/dummy-extension'),
    // path.join(__dirname, '../../extensions/ublock'),  // Falls vorhanden
  ],
});
```

## WICHTIG

- **Chromium ONLY:** Extensions funktionieren nur mit Chromium, NICHT mit Chrome!
- **Headless:** Extensions funktionieren auch im headless mode
- **Fingerprint:** Jede Extension verändert das Fingerprinting leicht - das ist GUT!

## Best Practices

1. **1-3 Extensions:** Nicht zu viele (verdächtig), nicht zu wenige (auch verdächtig)
2. **Bekannte Extensions:** Nutze beliebte Extensions wie uBlock, LastPass, etc.
3. **Dummy is OK:** Eine Dummy-Extension ist besser als keine Extension!
4. **Update nicht vergessen:** Alte Extension-Versionen können verdächtig sein

## Extension-Erkennung testen

```javascript
// Im Browser Console:
console.log(chrome.runtime);
console.log(navigator.plugins);
```

Wenn Extensions geladen sind, siehst du sie in chrome.runtime!
