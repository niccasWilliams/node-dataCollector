import { database as db } from "@/db";
import {
  scrapingQualityLogs,
  type ScrapingQualityLogInsert,
  type ScrapingQualitySeverity,
  type ScrapingQualityStatus,
} from "@/db/individual/individual-schema";
import type { ScrapedProductData } from "./price-scraper.service";
import { eq, and } from "drizzle-orm";
import { logger } from "@/utils/logger";

/**
 * Scraping Quality Service
 * Monitors scraping health and tracks issues across adapters
 */
export class ScrapingQualityService {
  /**
   * Log scraping result and track quality issues
   * Deduplicates based on domain + adapter + issue fingerprint
   */
  async logScrapingResult(options: {
    url: string;
    adapter?: string;
    scrapedData: ScrapedProductData;
    validation: { valid: boolean; errors: string[] };
    productId?: number;
    screenshotPath?: string;
    pageHtml?: string;
  }): Promise<void> {
    const { url, adapter, scrapedData, validation, productId, screenshotPath, pageHtml } = options;

    try {
      // Extract domain
      const domain = new URL(url).hostname;

      // Analyze what's missing
      const analysis = this.analyzeScrapingResult(scrapedData, validation);

      // Skip if everything is OK and no errors
      if (analysis.missingFields.length === 0 && validation.errors.length === 0) {
        return; // No issues to log
      }

      // Create issue fingerprint for deduplication
      const issueFingerprint = this.createIssueFingerprint(analysis.missingFields, adapter);

      // Calculate severity
      const severity = this.calculateSeverity(analysis.missingFields);

      // Check if we already have this issue logged
      const existing = await db.query.scrapingQualityLogs.findFirst({
        where: and(
          eq(scrapingQualityLogs.domain, domain),
          eq(scrapingQualityLogs.adapter, adapter || ""),
          eq(scrapingQualityLogs.issueFingerprint, issueFingerprint)
        ),
      });

      const now = new Date();

      if (existing) {
        // Update existing log
        await db
          .update(scrapingQualityLogs)
          .set({
            lastSeenAt: now,
            occurrenceCount: existing.occurrenceCount + 1,
            productId: productId || existing.productId, // Update if we have a product now
            url, // Update to latest URL
            screenshot: screenshotPath || existing.screenshot,
            updatedAt: now,
          })
          .where(eq(scrapingQualityLogs.id, existing.id));

        logger.debug(
          `[ScrapingQuality] Updated existing log ${existing.id} for ${domain}/${adapter} (count: ${existing.occurrenceCount + 1})`
        );
      } else {
        // Create new log
        const logData: ScrapingQualityLogInsert = {
          url,
          domain,
          adapter: adapter || null,
          productId: productId || null,
          issueFingerprint,
          missingFields: analysis.missingFields,
          fieldErrors: analysis.fieldErrors,
          extractedFields: analysis.extractedFields,
          validationErrors: validation.errors,
          severity,
          status: "open",
          firstSeenAt: now,
          lastSeenAt: now,
          occurrenceCount: 1,
          screenshot: screenshotPath || null,
          pageHtmlSample: pageHtml ? pageHtml.substring(0, 10000) : null, // First 10KB
          metadata: {},
        };

        const [created] = await db.insert(scrapingQualityLogs).values(logData).returning();

        logger.info(
          `[ScrapingQuality] Created new log ${created.id} for ${domain}/${adapter} - Severity: ${severity} - Missing: ${analysis.missingFields.join(", ")}`
        );
      }
    } catch (error) {
      logger.error("[ScrapingQuality] Failed to log scraping result:", error);
      // Don't throw - quality logging shouldn't break scraping
    }
  }

  /**
   * Analyze scraped data and identify issues
   */
  private analyzeScrapingResult(
    scrapedData: ScrapedProductData,
    validation: { valid: boolean; errors: string[] }
  ): {
    missingFields: string[];
    fieldErrors: Record<string, string>;
    extractedFields: Record<string, boolean>;
  } {
    const missingFields: string[] = [];
    const fieldErrors: Record<string, string> = {};
    const extractedFields: Record<string, boolean> = {};

    // Critical fields
    const criticalFields = {
      name: scrapedData.name,
      price: scrapedData.price,
    };

    // Important fields
    const importantFields = {
      brand: scrapedData.brand,
      availability: scrapedData.availability !== "unknown" ? scrapedData.availability : null,
      imageUrl: scrapedData.imageUrl,
    };

    // Optional fields
    const optionalFields = {
      ean: scrapedData.ean,
      asin: scrapedData.asin,
      description: scrapedData.description,
      originalPrice: scrapedData.originalPrice,
    };

    // Check critical fields
    for (const [field, value] of Object.entries(criticalFields)) {
      if (!value) {
        missingFields.push(field);
        fieldErrors[field] = "Missing critical field";
      } else {
        extractedFields[field] = true;
      }
    }

    // Check important fields
    for (const [field, value] of Object.entries(importantFields)) {
      if (!value) {
        missingFields.push(field);
        fieldErrors[field] = "Missing important field";
      } else {
        extractedFields[field] = true;
      }
    }

    // Check optional fields (only log if missing, not as severe)
    for (const [field, value] of Object.entries(optionalFields)) {
      if (!value) {
        missingFields.push(field);
      } else {
        extractedFields[field] = true;
      }
    }

    return { missingFields, fieldErrors, extractedFields };
  }

  /**
   * Create a deterministic fingerprint for deduplication
   * Same issues should have same fingerprint
   */
  private createIssueFingerprint(missingFields: string[], adapter?: string): string {
    const sorted = [...missingFields].sort();
    return `missing:${sorted.join(",")}|adapter:${adapter || "generic"}`;
  }

  /**
   * Calculate severity based on missing fields
   */
  private calculateSeverity(missingFields: string[]): ScrapingQualitySeverity {
    const criticalFields = ["name", "price"];
    const importantFields = ["brand", "availability", "imageUrl"];

    // Critical if any critical field is missing
    const hasCriticalMissing = missingFields.some((field) => criticalFields.includes(field));
    if (hasCriticalMissing) {
      return "critical";
    }

    // Warning if important fields are missing
    const hasImportantMissing = missingFields.some((field) => importantFields.includes(field));
    if (hasImportantMissing) {
      return "warning";
    }

    // Info if only optional fields are missing
    return "info";
  }

  /**
   * Get quality logs with filters
   */
  async getQualityLogs(options?: {
    domain?: string;
    adapter?: string;
    severity?: ScrapingQualitySeverity;
    status?: string;
    limit?: number;
  }) {
    const { domain, adapter, severity, status, limit = 100 } = options || {};

    const conditions = [];
    if (domain) conditions.push(eq(scrapingQualityLogs.domain, domain));
    if (adapter) conditions.push(eq(scrapingQualityLogs.adapter, adapter));
    if (severity) conditions.push(eq(scrapingQualityLogs.severity, severity));
    if (status) conditions.push(eq(scrapingQualityLogs.status, status as ScrapingQualityStatus));

    const query = db
      .select()
      .from(scrapingQualityLogs)
      .orderBy(scrapingQualityLogs.lastSeenAt);

    if (conditions.length > 0) {
      return query.where(and(...conditions)).limit(limit);
    }

    return query.limit(limit);
  }

  /**
   * Get quality statistics per adapter
   */
  async getAdapterStatistics() {
    // TODO: Implement aggregated statistics
    // GROUP BY adapter, severity
    // COUNT occurrences
    return [];
  }

  /**
   * Mark issue as resolved
   */
  async resolveIssue(logId: number, resolution: string, userId?: number) {
    await db
      .update(scrapingQualityLogs)
      .set({
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: userId || null,
        resolution,
        updatedAt: new Date(),
      })
      .where(eq(scrapingQualityLogs.id, logId));

    logger.info(`[ScrapingQuality] Resolved log ${logId}: ${resolution}`);
  }

  /**
   * Acknowledge issue (team is aware, working on it)
   */
  async acknowledgeIssue(logId: number, userId?: number) {
    await db
      .update(scrapingQualityLogs)
      .set({
        status: "acknowledged",
        updatedAt: new Date(),
      })
      .where(eq(scrapingQualityLogs.id, logId));

    logger.info(`[ScrapingQuality] Acknowledged log ${logId}`);
  }

  /**
   * Mark issue as ignored (known limitation)
   */
  async ignoreIssue(logId: number, notes: string, userId?: number) {
    await db
      .update(scrapingQualityLogs)
      .set({
        status: "ignored",
        resolutionNotes: notes,
        resolvedBy: userId || null,
        updatedAt: new Date(),
      })
      .where(eq(scrapingQualityLogs.id, logId));

    logger.info(`[ScrapingQuality] Ignored log ${logId}: ${notes}`);
  }
}

// Export singleton instance
export const scrapingQualityService = new ScrapingQualityService();
