import type { Request, Response } from "express";
import { scrapingQualityService } from "@/services/scraper/scraping-quality.service";
import { logger } from "@/utils/logger";

class ScrapingQualityController {
  /**
   * Get quality logs with optional filters
   */
  async getQualityLogs(req: Request, res: Response) {
    try {
      const { domain, adapter, severity, status, limit } = req.query;

      const logs = await scrapingQualityService.getQualityLogs({
        domain: domain as string | undefined,
        adapter: adapter as string | undefined,
        severity: severity as any,
        status: status as string | undefined,
        limit: limit ? parseInt(limit as string) : undefined,
      });

      res.json({
        success: true,
        data: logs,
      });
    } catch (error) {
      logger.error("[ScrapingQualityController] getQualityLogs failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch quality logs",
      });
    }
  }

  /**
   * Get quality statistics by adapter
   */
  async getAdapterStatistics(req: Request, res: Response) {
    try {
      const stats = await scrapingQualityService.getAdapterStatistics();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error("[ScrapingQualityController] getAdapterStatistics failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch adapter statistics",
      });
    }
  }

  /**
   * Resolve a quality issue
   */
  async resolveIssue(req: Request, res: Response) {
    try {
      const logId = parseInt(req.params.logId);
      const { resolution } = req.body;

      if (!resolution) {
        return res.status(400).json({
          success: false,
          error: "Resolution text is required",
        });
      }

      await scrapingQualityService.resolveIssue(logId, resolution);

      res.json({
        success: true,
        message: "Issue resolved successfully",
      });
    } catch (error) {
      logger.error("[ScrapingQualityController] resolveIssue failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to resolve issue",
      });
    }
  }

  /**
   * Acknowledge a quality issue
   */
  async acknowledgeIssue(req: Request, res: Response) {
    try {
      const logId = parseInt(req.params.logId);

      await scrapingQualityService.acknowledgeIssue(logId);

      res.json({
        success: true,
        message: "Issue acknowledged successfully",
      });
    } catch (error) {
      logger.error("[ScrapingQualityController] acknowledgeIssue failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to acknowledge issue",
      });
    }
  }

  /**
   * Ignore a quality issue
   */
  async ignoreIssue(req: Request, res: Response) {
    try {
      const logId = parseInt(req.params.logId);
      const { notes } = req.body;

      if (!notes) {
        return res.status(400).json({
          success: false,
          error: "Notes are required when ignoring an issue",
        });
      }

      await scrapingQualityService.ignoreIssue(logId, notes);

      res.json({
        success: true,
        message: "Issue ignored successfully",
      });
    } catch (error) {
      logger.error("[ScrapingQualityController] ignoreIssue failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to ignore issue",
      });
    }
  }
}

export const scrapingQualityController = new ScrapingQualityController();
