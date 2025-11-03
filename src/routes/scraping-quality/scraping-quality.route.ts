import { Router } from "express";
import { scrapingQualityController } from "./scraping-quality.controller";

const router = Router();

/**
 * @openapi
 * /scraping-quality/logs:
 *   get:
 *     summary: Get scraping quality logs
 *     description: |
 *       Get scraping quality issues with optional filters.
 *       Tracks missing fields, extraction errors, and adapter health.
 *     tags:
 *       - Scraping Quality
 *     parameters:
 *       - in: query
 *         name: domain
 *         schema:
 *           type: string
 *         description: Filter by domain (e.g., "amazon.de")
 *       - in: query
 *         name: adapter
 *         schema:
 *           type: string
 *         description: Filter by adapter (e.g., "Amazon", "MediaMarkt")
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [critical, warning, info]
 *         description: Filter by severity
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [open, acknowledged, resolved, ignored]
 *         description: Filter by status
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Max number of results
 *     responses:
 *       200:
 *         description: Quality logs retrieved successfully
 */
router.get("/logs", scrapingQualityController.getQualityLogs);

/**
 * @openapi
 * /scraping-quality/statistics:
 *   get:
 *     summary: Get adapter statistics
 *     description: Get aggregated statistics per adapter (success rate, common issues)
 *     tags:
 *       - Scraping Quality
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get("/statistics", scrapingQualityController.getAdapterStatistics);

/**
 * @openapi
 * /scraping-quality/logs/{logId}/resolve:
 *   post:
 *     summary: Resolve a quality issue
 *     description: Mark an issue as resolved with a resolution message
 *     tags:
 *       - Scraping Quality
 *     parameters:
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolution
 *             properties:
 *               resolution:
 *                 type: string
 *                 example: "Updated selector in adapter"
 *     responses:
 *       200:
 *         description: Issue resolved successfully
 */
router.post("/logs/:logId/resolve", scrapingQualityController.resolveIssue);

/**
 * @openapi
 * /scraping-quality/logs/{logId}/acknowledge:
 *   post:
 *     summary: Acknowledge a quality issue
 *     description: Mark that the team is aware and working on it
 *     tags:
 *       - Scraping Quality
 *     parameters:
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Issue acknowledged successfully
 */
router.post("/logs/:logId/acknowledge", scrapingQualityController.acknowledgeIssue);

/**
 * @openapi
 * /scraping-quality/logs/{logId}/ignore:
 *   post:
 *     summary: Ignore a quality issue
 *     description: Mark as known limitation that won't be fixed
 *     tags:
 *       - Scraping Quality
 *     parameters:
 *       - in: path
 *         name: logId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - notes
 *             properties:
 *               notes:
 *                 type: string
 *                 example: "Description field not available on this site"
 *     responses:
 *       200:
 *         description: Issue ignored successfully
 */
router.post("/logs/:logId/ignore", scrapingQualityController.ignoreIssue);

export const scrapingQualityRoutes = router;
