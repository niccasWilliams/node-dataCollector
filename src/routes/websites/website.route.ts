import { Router } from "express";
import { websiteController } from "./website.controller";

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Website Inventory
 *     description: Verwalte gecrawlte Websites und deren Elemente aus deinen Browser-Sessions.
 */

/**
 * @openapi
 * /websites:
 *   get:
 *     summary: Liste der gespeicherten Websites abrufen
 *     description: Liefert paginierte Informationen zu bekannten Websites inklusive Element-Anzahl.
 *     tags:
 *       - Website Inventory
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filtert nach Domain, URL oder Titel.
 *       - in: query
 *         name: domain
 *         schema:
 *           type: string
 *         description: Zeigt nur Websites dieser Domain.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *         description: Anzahl der Ergebnisse pro Seite.
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Start-Offset für die Pagination.
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [createdAt, lastScannedAt]
 *         description: Sortierkriterium.
 *       - in: query
 *         name: sortDirection
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sortierrichtung.
 *     responses:
 *       200:
 *         description: Erfolgreich geladen.
 */
router.get("/", websiteController.listWebsites);

/**
 * @openapi
 * /websites/resolve:
 *   get:
 *     summary: Website anhand einer URL auflösen
 *     description: Liefert die gespeicherten Metadaten und interaktiven Elemente zu einer URL (falls Snapshot vorhanden).
 *     tags:
 *       - Website Inventory
 *     parameters:
 *       - in: query
 *         name: url
 *         required: true
 *         schema:
 *           type: string
 *         description: Absolute URL, die auf eine gespeicherte Website verweist.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *         description: Anzahl der zurückgegebenen Elemente (Standard 50).
 *     responses:
 *       200:
 *         description: Website gefunden.
 *       400:
 *         description: URL fehlt oder ist ungültig.
 *       404:
 *         description: Kein Snapshot bekannt.
 */
router.get("/resolve", websiteController.getWebsiteByUrl);

/**
 * @openapi
 * /websites/{websiteId}:
 *   get:
 *     summary: Einzelne Website abrufen
 *     tags:
 *       - Website Inventory
 *     parameters:
 *       - in: path
 *         name: websiteId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Website gefunden.
 *       404:
 *         description: Keine Website mit dieser ID vorhanden.
 */
router.get("/:websiteId", websiteController.getWebsiteById);

/**
 * @openapi
 * /websites/{websiteId}/elements:
 *   get:
 *     summary: Elemente einer Website abrufen
 *     description: Liefert gespeicherte interaktive DOM-Elemente der letzten Snapshot-Erfassung.
 *     tags:
 *       - Website Inventory
 *     parameters:
 *       - in: path
 *         name: websiteId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: tags
 *         schema:
 *           type: string
 *         description: Kommagetrennte Liste an Tag-Namen, um Elemente zu filtern.
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Volltextsuche über Text, Selector und Rolle.
 *       - in: query
 *         name: visible
 *         schema:
 *           type: boolean
 *         description: Filtert nach sichtbaren bzw. versteckten Elementen.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 500
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *     responses:
 *       200:
 *         description: Elemente gefunden.
 *       404:
 *         description: Website nicht vorhanden.
 */
router.get("/:websiteId/elements", websiteController.getWebsiteElements);

/**
 * @openapi
 * /websites/sessions/{sessionId}/snapshot:
 *   post:
 *     summary: Snapshot aus aktiver Browser-Session speichern
 *     description: Erfasst Elemente der laufenden Browser-Session und persistiert Website + interaktive DOM-Knoten.
 *     tags:
 *       - Website Inventory
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
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optionaler Tag-Filter für die Element-Erfassung (<code>*</code> für alle).
 *               includeHidden:
 *                 type: boolean
 *                 description: Auch versteckte Elemente aufnehmen.
 *               limit:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 1000
 *                 description: Obergrenze für die Anzahl erfasster Elemente.
 *     responses:
 *       200:
 *         description: Snapshot erstellt.
 *       400:
 *         description: Ungültige Session-ID.
 *       500:
 *         description: Snapshot konnte nicht erzeugt werden.
 */
router.post(
  "/sessions/:sessionId/snapshot",
  websiteController.captureSessionSnapshot
);

export const websiteRoutes = router;
