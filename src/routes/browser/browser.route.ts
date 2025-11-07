import express from 'express';
import path from 'path';
import { browserController } from './browser.controller';

const router = express.Router();

router.get('/', (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'public', 'browser', 'index.html'));
});

/**
 * @openapi
 * tags:
 *   - name: Browser Automation
 *     description: Steuert echte Chrome-Sessions (Login, Navigation, Screenshots, Interaktion, Extraktion).
 */

/**
 * @openapi
 * /browser/session:
 *   post:
 *     summary: Neue Browser-Session starten
 *     description: |
 *       Öffnet eine neue Chrome-Automation-Session mit **MAXIMUM STEALTH** by default!
 *
 *       **Automatische Features (immer aktiv):**
 *       - 🔒 **Stealth Mode** - Chromium mit Extensions, WebRTC-Schutz, Fingerprinting-Schutz
 *       - 🤖 **Humanized Timing** - 100ms slowMo, natürliche Interaktionen
 *       - 👁️ **Visible Mode** - Browser ist sichtbar (authentischer!)
 *       - 🍪 **Cookie Auto-Reject** - Cookies automatisch ablehnen
 *       - 🚨 **Bot-Detection Monitoring** - Warnt bei CAPTCHA, Blocks, etc.
 *
 *       **Du musst NUR konfigurieren:**
 *       - `persistProfile` - Um angemeldet zu bleiben (optional)
 *       - `onBotDetected` - Um Session bei Bot-Detection zu stoppen (optional)
 *
 *       **Beispiele:**
 *       ```json
 *       // Einfachste Session (temporär)
 *       {}
 *
 *       // Mit persistent profile (bleibt eingeloggt!)
 *       { "config": { "persistProfile": "onlogist" } }
 *
 *       // Session stoppt bei Bot-Detection
 *       {
 *         "config": {
 *           "persistProfile": "onlogist",
 *           "onBotDetected": "stop"
 *         }
 *       }
 *       ```
 *     tags:
 *       - Browser Automation
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               config:
 *                 type: object
 *                 description: Browser-Konfiguration (meist leer, Defaults sind optimal!)
 *                 properties:
 *                   persistProfile:
 *                     oneOf:
 *                       - type: boolean
 *                       - type: string
 *                     description: |
 *                       🔐 **Persistent Browser-Profil** (bleibt angemeldet!)
 *                       - `"profile-name"`: Verwendet spezifisches Profil (empfohlen!)
 *                       - `true`: Auto-erstellt Profil basierend auf URL
 *                       - `false`/`undefined`: Temporäre Session (default)
 *
 *                       **Wichtig:** Profile speichern:
 *                       - Cookies & Sessions (bleibst angemeldet!)
 *                       - LocalStorage
 *                       - **Konsistenten Browser-Fingerprint** (wichtig gegen Logout!)
 *
 *                       **Beispiel:**
 *                       ```json
 *                       { "persistProfile": "onlogist" }
 *                       ```
 *                     example: "onlogist"
 *                   botDetection:
 *                     type: boolean
 *                     description: |
 *                       🚨 Automatische Bot-Detection-Erkennung
 *                       - `true` (default): Prüft bei jeder Navigation
 *                       - `false`: Deaktiviert (nicht empfohlen!)
 *                     default: true
 *                   onBotDetected:
 *                     type: string
 *                     enum: [warn, stop, ignore]
 *                     description: |
 *                       Aktion bei Bot-Detection:
 *                       - `warn` (default): Warnung loggen, weitermachen
 *                       - `stop`: Session **sofort schließen** (sicherer!)
 *                       - `ignore`: Nicht prüfen (NICHT empfohlen!)
 *                     default: "warn"
 *                   headless:
 *                     type: boolean
 *                     description: |
 *                       ⚠️ **@internal** - Headless-Modus (Standard: `false` = visible)
 *                       Visible ist authentischer! Nur für Debugging ändern.
 *                     default: false
 *                   slowMo:
 *                     type: number
 *                     description: |
 *                       ⚠️ **@internal** - Verlangsamung in ms (Standard: `100`)
 *                       Humanized timing! Nur für Debugging ändern.
 *                     default: 100
 *     responses:
 *       200:
 *         description: Session erstellt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: Session-ID
 *                     status:
 *                       type: string
 *                       enum: [idle, active, navigating, closed]
 *                     currentUrl:
 *                       type: string
 *                       nullable: true
 *                     title:
 *                       type: string
 *                       nullable: true
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 */
router.post('/session', browserController.createSession);

/**
 * @openapi
 * /browser/session/{sessionId}:
 *   get:
 *     summary: Session-Info abrufen
 *     description: Liefert Infos zur aktiven Browser-Session (URL, Status etc.).
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID der Session.
 *     responses:
 *       200:
 *         description: Session gefunden
 *       404:
 *         description: Session nicht gefunden
 */
router.get('/session/:sessionId', browserController.getSessionById);

/**
 * @openapi
 * /browser/sessions/history:
 *   get:
 *     summary: Session-Historie abrufen
 *     description: Liefert die zuletzt persistent gespeicherten Browser-Sessions (auch beendete).
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *         description: Anzahl der Datensätze (Standard 50).
 *     responses:
 *       200:
 *         description: Historische Sessions geladen
 */
router.get('/sessions/history', browserController.getSessionHistory);

/**
 * @openapi
 * /browser/sessions/history/{sessionId}:
 *   delete:
 *     summary: Session-Eintrag aus der Historie entfernen
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Eintrag gelöscht
 *       404:
 *         description: Eintrag nicht gefunden
 */
router.delete('/sessions/history/:sessionId', browserController.deleteSessionHistoryEntry);

/**
 * @openapi
 * /browser/sessions:
 *   get:
 *     summary: Alle aktiven Sessions abrufen
 *     tags:
 *       - Browser Automation
 *     responses:
 *       200:
 *         description: Liste der Sessions
 */
router.get('/sessions', browserController.getSessions);

/**
 * @openapi
 * /browser/session/{sessionId}:
 *   delete:
 *     summary: Browser-Session schließen
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session geschlossen
 */
router.delete('/session/:sessionId', browserController.deleteSession);

/**
 * @openapi
 * /browser/session/{sessionId}/navigate:
 *   post:
 *     summary: Zu einer URL navigieren
 *     description: Öffnet eine bestimmte URL in der Session.
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *                 description: Ziel-URL
 *               options:
 *                 type: object
 *                 description: Zusätzliche Navigationsoptionen (z.B. WaitUntil).
 *     responses:
 *       200:
 *         description: Navigation ausgeführt
 */
router.post('/session/:sessionId/navigate', browserController.navigateToUrl);

/**
 * @openapi
 * /browser/session/{sessionId}/back:
 *   post:
 *     summary: Browser-History zurück
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Zurück navigiert
 */
router.post('/session/:sessionId/back', browserController.goBack);

/**
 * @openapi
 * /browser/session/{sessionId}/forward:
 *   post:
 *     summary: Browser-History vor
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Vor navigiert
 */
router.post('/session/:sessionId/forward', browserController.goForward);

/**
 * @openapi
 * /browser/session/{sessionId}/reload:
 *   post:
 *     summary: Seite neu laden
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Seite neu geladen
 */
router.post('/session/:sessionId/reload', browserController.reload);

/**
 * @openapi
 * /browser/session/{sessionId}/screenshot:
 *   post:
 *     summary: Screenshot aufnehmen
 *     description: Nimmt ein Screenshot (ganze Seite optional) und speichert es lokal.
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullPage:
 *                 type: boolean
 *               type:
 *                 type: string
 *                 enum: [png, jpeg]
 *               quality:
 *                 type: number
 *     responses:
 *       200:
 *         description: Screenshot erstellt
 */
router.post('/session/:sessionId/screenshot', browserController.takeScreenshot);

/**
 * @openapi
 * /browser/screenshots/{filename}:
 *   get:
 *     summary: Screenshot abrufen
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bilddaten
 *       404:
 *         description: Nicht gefunden
 */
router.get('/screenshots/:filename', browserController.getFileByName);

/**
 * @openapi
 * /browser/session/{sessionId}/click:
 *   post:
 *     summary: Klicke ein Element
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selector:
 *                 type: string
 *                 description: CSS-Selector des Elements.
 *     responses:
 *       200:
 *         description: Klick ausgeführt
 */
router.post('/session/:sessionId/click', browserController.clickElement);

/**
 * @openapi
 * /browser/session/{sessionId}/type:
 *   post:
 *     summary: Tippe in ein Input-Feld
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selector:
 *                 type: string
 *               text:
 *                 type: string
 *     responses:
 *       200:
 *         description: Text eingetippt
 */
router.post('/session/:sessionId/type', browserController.typeIntoField);

/**
 * @openapi
 * /browser/session/{sessionId}/select:
 *   post:
 *     summary: Dropdown-Option wählen
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selector:
 *                 type: string
 *               value:
 *                 type: string
 *     responses:
 *       200:
 *         description: Option gewählt
 */
router.post('/session/:sessionId/select', browserController.selectOption);

/**
 * @openapi
 * /browser/session/{sessionId}/hover:
 *   post:
 *     summary: Mit Maus über ein Element fahren
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selector:
 *                 type: string
 *     responses:
 *       200:
 *         description: Hover ausgeführt
 */
router.post('/session/:sessionId/hover', browserController.hoverOverElement);

/**
 * @openapi
 * /browser/session/{sessionId}/scroll:
 *   post:
 *     summary: Auf der Seite scrollen
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               x:
 *                 type: number
 *               y:
 *                 type: number
 *     responses:
 *       200:
 *         description: Scroll durchgeführt
 */
router.post('/session/:sessionId/scroll', browserController.scrollPage);

/**
 * @openapi
 * /browser/session/{sessionId}/wait:
 *   post:
 *     summary: Auf Element warten
 *     description: Wartet, bis ein bestimmter Selector sichtbar/available ist.
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selector:
 *                 type: string
 *               options:
 *                 type: object
 *                 description: z.B. Timeout ms
 *     responses:
 *       200:
 *         description: Element wurde gefunden
 */
router.post('/session/:sessionId/wait', browserController.waitForElement);

/**
 * @openapi
 * /browser/session/{sessionId}/info:
 *   get:
 *     summary: Page/Session Infos holen
 *     description: Liefert Titel, URL usw.
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Infos zur aktuellen Seite
 */
router.get('/session/:sessionId/info', browserController.getPageInfo);

/**
 * @openapi
 * /browser/session/{sessionId}/html:
 *   get:
 *     summary: HTML der aktuellen Seite holen
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: HTML der Seite
 */
router.get('/session/:sessionId/html', browserController.getPageHTML);

/**
 * @openapi
 * /browser/session/{sessionId}/elements:
 *   get:
 *     summary: Liste der DOM-Elemente abrufen
 *     description: Liefert Metadaten (Tag, Text, Attribute, Sichtbarkeit) für Elemente der aktuellen Seite
 *       und persistiert sie für spätere Wiederverwendung.
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: tags
 *         required: false
 *         schema:
 *           type: string
 *         description: Kommagetrennte Liste von Tag-Namen (z. B. `button,input`). Verwende `*` um alle Tags zurückzugeben.
 *       - in: query
 *         name: includeHidden
 *         required: false
 *         schema:
 *           type: boolean
 *         description: Verborgene Elemente einschließen (Standard false).
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *         description: Maximale Anzahl der zurückgegebenen Elemente (Standard 500).
 *     responses:
 *       200:
 *         description: Aktueller Snapshot der Seite inklusive Elemente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     website:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: integer
 *                         url:
 *                           type: string
 *                         domain:
 *                           type: string
 *                         path:
 *                           type: string
 *                         title:
 *                           type: string
 *                           nullable: true
 *                         lastScannedAt:
 *                           type: string
 *                           format: date-time
*                         elementCount:
*                           type: integer
*                         totalElements:
*                           type: integer
*                     elements:
*                       type: array
*                       items:
*                         type: object
*                         properties:
*                           tag:
*                             type: string
*                           selector:
*                             type: string
*                           text:
*                             type: string
*                           attributes:
*                             type: object
*                           visible:
*                             type: boolean
*                           disabled:
*                             type: boolean
 */
router.get('/session/:sessionId/elements', browserController.getPageElements);

/**
 * @openapi
 * /browser/session/{sessionId}/evaluate:
 *   post:
 *     summary: Custom JavaScript im Browser ausführen
 *     description: Führt einen Funktions-Body direkt im Seitenkontext aus (Vorsicht!).
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - script
 *             properties:
 *               script:
 *                 type: string
 *                 description: Muss eine Function sein, z.B. `() => document.title`.
 *     responses:
 *       200:
 *         description: Rückgabewert der Function
 */
router.post('/session/:sessionId/evaluate', browserController.executeScript);

/**
 * @openapi
 * /browser/session/{sessionId}/navigate-and-wait:
 *   post:
 *     summary: Navigiere zu URL und warte auf bestimmtes Element
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               url:
 *                 type: string
 *               selector:
 *                 type: string
 *               options:
 *                 type: object
 *     responses:
 *       200:
 *         description: Navigation abgeschlossen und Element gefunden
 */
router.post('/session/:sessionId/navigate-and-wait', browserController.navigateAndWait);

/**
 * @openapi
 * /browser/session/{sessionId}/fill-form:
 *   post:
 *     summary: Formular ausfüllen und abschicken
 *     description: Füllt mehrere Eingabefelder anhand von CSS-Selektoren und klickt anschließend auf den Submit-Button.
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *         description: Die eindeutige ID der aktiven Browser-Session
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fields
 *               - submitSelector
 *             properties:
 *               fields:
 *                 type: array
 *                 description: Liste der Eingabefelder, die ausgefüllt werden sollen
 *                 items:
 *                   type: object
 *                   required:
 *                     - selector
 *                     - value
 *                   properties:
 *                     selector:
 *                       type: string
 *                       example: "input[name='email']"
 *                       description: CSS-Selector des Eingabefelds
 *                     value:
 *                       type: string
 *                       example: "xx@email.com"
 *                       description: Text, der in das Feld eingetragen werden soll
 *               submitSelector:
 *                 type: string
 *                 example: "button[type='submit']"
 *                 description: CSS-Selector des Buttons, der nach dem Ausfüllen angeklickt wird
 *     responses:
 *       200:
 *         description: Formular erfolgreich ausgefüllt und abgeschickt
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Form filled and submitted
 *       500:
 *         description: Fehler beim Ausfüllen oder Senden des Formulars
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Selector not found"
 */
router.post('/session/:sessionId/fill-form', browserController.fillForm);

/**
 * @openapi
 * /browser/session/{sessionId}/is-logged-in:
 *   post:
 *     summary: Prüfe, ob Benutzer eingeloggt ist
 *     description: Führt eine einfache Prüfung durch, ob der Benutzer in der Session eingeloggt ist.
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Login-Status
 */
router.post('/session/:sessionId/is-logged-in', browserController.isLoggedIn);

/**
 * @openapi
 * /browser/session/{sessionId}/logout:
 *   post:
 *     summary: Nutzer ausloggen
 *     description: Klickt logout-relevante Elemente (manuell über Selektoren oder automatisch per Keyword-Suche).
 *     tags:
 *       - Browser Automation
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               selectors:
 *                 type: array
 *                 description: Selektoren, die priorisiert geklickt werden sollen.
 *                 items:
 *                   type: string
 *               keywords:
 *                 type: array
 *                 description: Zusätzliche Keywords für die automatische Logout-Suche.
 *                 items:
 *                   type: string
 *               waitForNavigation:
 *                 type: boolean
 *                 description: Auf Navigation nach dem Klick warten (Default true).
 *               timeout:
 *                 type: integer
 *                 description: Timeout in Millisekunden für Warte-Operationen.
 *     responses:
 *       200:
 *         description: Ergebnis der Logout-Aktion
 */
router.post('/session/:sessionId/logout', browserController.logout);

/**
 * @openapi
 * tags:
 *   - name: Humanized Interactions
 *     description: Menschlich wirkende Browser-Interaktionen (Bezier-Kurven, Tippfehler, etc.) zur Vermeidung von Bot-Detection
 */

/**
 * @openapi
 * /browser/session/{sessionId}/click-humanized:
 *   post:
 *     summary: Element mit menschlicher Mausbewegung klicken
 *     description: Klickt ein Element mit natürlicher Mausbewegung (Bezier-Kurven, variable Geschwindigkeit, gelegentliches Overshoot).
 *     tags:
 *       - Humanized Interactions
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - selector
 *             properties:
 *               selector:
 *                 type: string
 *                 description: CSS-Selector des Elements
 *                 example: "button.submit"
 *               button:
 *                 type: string
 *                 enum: [left, right, middle]
 *                 description: Maustaste (Standard left)
 *               clickCount:
 *                 type: integer
 *                 description: Anzahl der Klicks (z.B. 2 für Doppelklick)
 *     responses:
 *       200:
 *         description: Element wurde geklickt
 *       400:
 *         description: Ungültige Parameter
 *       500:
 *         description: Fehler beim Klicken
 */
router.post('/session/:sessionId/click-humanized', browserController.clickHumanized);

/**
 * @openapi
 * /browser/session/{sessionId}/type-humanized:
 *   post:
 *     summary: Text mit menschlichem Tippverhalten eingeben
 *     description: Tippt Text mit variabler Geschwindigkeit, gelegentlichen Tippfehlern (3%) und natürlichen Pausen.
 *     tags:
 *       - Humanized Interactions
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 description: Text, der eingetippt werden soll
 *                 example: "Hallo Welt!"
 *               selector:
 *                 type: string
 *                 description: Optional CSS-Selector eines Input-Felds (wird vorher angeklickt)
 *                 example: "input[name='search']"
 *     responses:
 *       200:
 *         description: Text wurde eingetippt
 *       400:
 *         description: Ungültige Parameter
 *       500:
 *         description: Fehler beim Tippen
 */
router.post('/session/:sessionId/type-humanized', browserController.typeHumanized);

/**
 * @openapi
 * /browser/session/{sessionId}/scroll-humanized:
 *   post:
 *     summary: Seite mit menschlichem Scrollverhalten scrollen
 *     description: Scrollt die Seite sanft und natürlich, wie es ein Mensch tun würde.
 *     tags:
 *       - Humanized Interactions
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               direction:
 *                 type: string
 *                 enum: [up, down]
 *                 description: Scroll-Richtung (Standard down)
 *               amount:
 *                 type: integer
 *                 description: Scroll-Distanz in Pixeln (Standard zufällig 200-600)
 *               smooth:
 *                 type: boolean
 *                 description: Sanftes Scrollen in kleinen Schritten (Standard true)
 *     responses:
 *       200:
 *         description: Seite wurde gescrollt
 *       500:
 *         description: Fehler beim Scrollen
 */
router.post('/session/:sessionId/scroll-humanized', browserController.scrollHumanized);

/**
 * @openapi
 * /browser/session/{sessionId}/simulate-reading:
 *   post:
 *     summary: Menschliches Leseverhalten simulieren
 *     description: Simuliert natürliches Leseverhalten mit zufälligen Mausbewegungen und gelegentlichem Scrollen.
 *     tags:
 *       - Humanized Interactions
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               duration:
 *                 type: integer
 *                 description: Dauer der Simulation in Millisekunden (Standard 2000-5000ms)
 *     responses:
 *       200:
 *         description: Leseverhalten wurde simuliert
 *       500:
 *         description: Fehler bei der Simulation
 */
router.post('/session/:sessionId/simulate-reading', browserController.simulateReading);

/**
 * @openapi
 * tags:
 *   - name: CAPTCHA Solving
 *     description: Automatisches Erkennen und Lösen von CAPTCHAs (reCAPTCHA, hCaptcha, etc.) via 2Captcha/CapSolver/Anti-Captcha
 */

/**
 * @openapi
 * /browser/session/{sessionId}/solve-captcha:
 *   post:
 *     summary: CAPTCHA automatisch erkennen und lösen
 *     description: Erkennt automatisch welcher CAPTCHA-Typ auf der Seite ist (reCAPTCHA v2, hCaptcha, etc.) und löst ihn.
 *     tags:
 *       - CAPTCHA Solving
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: CAPTCHA erfolgreich gelöst oder nicht gefunden
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     type:
 *                       type: string
 *                       description: Erkannter CAPTCHA-Typ
 *                       example: "recaptcha_v2"
 *                     solution:
 *                       type: string
 *                       description: CAPTCHA-Token
 *       500:
 *         description: Fehler beim Lösen
 */
router.post('/session/:sessionId/solve-captcha', browserController.solveCaptchaAuto);

/**
 * @openapi
 * /browser/session/{sessionId}/solve-recaptcha-v2:
 *   post:
 *     summary: reCAPTCHA v2 lösen
 *     description: Sucht nach reCAPTCHA v2 auf der Seite und löst es.
 *     tags:
 *       - CAPTCHA Solving
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: reCAPTCHA v2 erfolgreich gelöst oder nicht gefunden
 *       500:
 *         description: Fehler beim Lösen
 */
router.post('/session/:sessionId/solve-recaptcha-v2', browserController.solveRecaptchaV2);

/**
 * @openapi
 * /browser/session/{sessionId}/solve-hcaptcha:
 *   post:
 *     summary: hCaptcha lösen
 *     description: Sucht nach hCaptcha auf der Seite und löst es.
 *     tags:
 *       - CAPTCHA Solving
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: hCaptcha erfolgreich gelöst oder nicht gefunden
 *       500:
 *         description: Fehler beim Lösen
 */
router.post('/session/:sessionId/solve-hcaptcha', browserController.solveHCaptcha);

/**
 * @openapi
 * tags:
 *   - name: Safety Features
 *     description: Neue Sicherheits-Features - Bot-Detection-Detection und Persistent Browser Profiles
 */

/**
 * @openapi
 * /browser/session/{sessionId}/check-bot-detection:
 *   post:
 *     summary: Prüfe Seite auf Bot-Detection-Indikatoren
 *     description: |
 *       Prüft die aktuelle Seite auf Anzeichen von Bot-Detection:
 *       - CAPTCHA (reCAPTCHA, hCaptcha, CloudFlare Turnstile)
 *       - "Access Denied" / "Blocked" Seiten
 *       - CloudFlare/Akamai Challenges
 *       - Rate-Limiting-Warnungen
 *       - Verdächtige Redirects
 *       - Anti-Bot-JavaScript (PerimeterX, DataDome, etc.)
 *
 *       **Wird automatisch bei jeder Navigation geprüft** (wenn `botDetection: true`)
 *     tags:
 *       - Safety Features
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bot-Detection-Status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     detected:
 *                       type: boolean
 *                       description: Wurde Bot-Detection erkannt?
 *                     confidence:
 *                       type: number
 *                       description: Confidence-Score (0-100%)
 *                       example: 75
 *                     indicators:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [captcha, blocked, challenge, rate-limit, redirect, suspicious-js]
 *                           severity:
 *                             type: string
 *                             enum: [low, medium, high, critical]
 *                           evidence:
 *                             type: string
 *                           selector:
 *                             type: string
 *                             nullable: true
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     url:
 *                       type: string
 *       500:
 *         description: Fehler beim Prüfen
 */
router.post('/session/:sessionId/check-bot-detection', browserController.checkBotDetection);

/**
 * @openapi
 * /browser/profiles:
 *   get:
 *     summary: Alle Browser-Profile abrufen
 *     description: |
 *       Listet alle persistenten Browser-Profile auf.
 *       Profile enthalten Cookies, LocalStorage, etc. und bleiben über Sessions hinweg erhalten.
 *     tags:
 *       - Safety Features
 *     responses:
 *       200:
 *         description: Liste der Profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: "onlogist"
 *                       path:
 *                         type: string
 *                         example: "/Users/.../.node-datacollector/browser-profiles/onlogist"
 *                       website:
 *                         type: string
 *                         nullable: true
 *                         example: "onlogist.com"
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       lastUsedAt:
 *                         type: string
 *                         format: date-time
 */
router.get('/profiles', browserController.getProfiles);

/**
 * @openapi
 * /browser/profiles/{profileName}:
 *   delete:
 *     summary: Browser-Profil löschen
 *     description: |
 *       Löscht ein persistentes Browser-Profil dauerhaft.
 *       **ACHTUNG:** Alle Cookies, LocalStorage, etc. gehen verloren!
 *       Du musst dich neu einloggen, wenn du dieses Profil wieder verwendest.
 *     tags:
 *       - Safety Features
 *     parameters:
 *       - in: path
 *         name: profileName
 *         required: true
 *         schema:
 *           type: string
 *         example: "old-profile"
 *     responses:
 *       200:
 *         description: Profil gelöscht
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *       404:
 *         description: Profil nicht gefunden
 */
router.delete('/profiles/:profileName', browserController.deleteProfile);

/**
 * @openapi
 * /browser/profiles/cleanup:
 *   post:
 *     summary: Alte Profile aufräumen
 *     description: Löscht Profile, die länger als X Tage nicht verwendet wurden.
 *     tags:
 *       - Safety Features
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               daysOld:
 *                 type: integer
 *                 description: Alter in Tagen (Standard 30)
 *                 default: 30
 *                 example: 30
 *     responses:
 *       200:
 *         description: Aufräumen abgeschlossen
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     deleted:
 *                       type: integer
 *                       description: Anzahl gelöschter Profile
 */
router.post('/profiles/cleanup', browserController.cleanupProfiles);

export default router;
