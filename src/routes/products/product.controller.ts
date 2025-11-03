import type { Request, Response } from "express";
import { productService } from "./product.service";
import { scrapingOrchestrator } from "@/services/scraper/scraping-orchestrator.service";
import { logger } from "@/utils/logger";

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

class ProductController {
  // ============================================================================
  // PRODUCT MANAGEMENT
  // ============================================================================

  async listProducts(req: Request, res: Response) {
    try {
      const { search, ean, brand, category, orderBy, sortDirection } = req.query;
      const limit = parseNumber(req.query.limit);
      const offset = parseNumber(req.query.offset);

      const result = await productService.listProducts({
        search: typeof search === "string" ? search : undefined,
        ean: typeof ean === "string" ? ean : undefined,
        brand: typeof brand === "string" ? brand : undefined,
        category: typeof category === "string" ? category : undefined,
        limit,
        offset,
        orderBy:
          orderBy === "createdAt" || orderBy === "updatedAt" || orderBy === "name"
            ? orderBy
            : undefined,
        sortDirection:
          sortDirection === "asc" || sortDirection === "desc"
            ? sortDirection
            : undefined,
      });

      res.json({
        success: true,
        data: result.items,
        meta: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error) {
      logger.error("[ProductController] listProducts failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch products",
      });
    }
  }

  async getProductById(req: Request, res: Response) {
    try {
      const productId = Number(req.params.productId);
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid product ID",
        });
      }

      const product = await productService.getProductById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      logger.error("[ProductController] getProductById failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch product",
      });
    }
  }

  async createProduct(req: Request, res: Response) {
    try {
      const { name, ean, asin, brand, model, category, description, imageUrl, metadata } =
        req.body;

      if (!name || typeof name !== "string") {
        return res.status(400).json({
          success: false,
          error: "Product name is required",
        });
      }

      const product = await productService.createProduct({
        name,
        ean: ean || null,
        asin: asin || null,
        brand: brand || null,
        model: model || null,
        category: category || null,
        description: description || null,
        imageUrl: imageUrl || null,
        metadata: metadata || {},
      });

      res.status(201).json({
        success: true,
        data: product,
      });
    } catch (error) {
      logger.error("[ProductController] createProduct failed", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create product",
      });
    }
  }

  async updateProduct(req: Request, res: Response) {
    try {
      const productId = Number(req.params.productId);
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid product ID",
        });
      }

      const { name, ean, asin, brand, model, category, description, imageUrl, metadata } =
        req.body;

      const product = await productService.updateProduct(productId, {
        name,
        ean,
        asin,
        brand,
        model,
        category,
        description,
        imageUrl,
        metadata,
      });

      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      res.json({
        success: true,
        data: product,
      });
    } catch (error) {
      logger.error("[ProductController] updateProduct failed", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to update product",
      });
    }
  }

  async deleteProduct(req: Request, res: Response) {
    try {
      const productId = Number(req.params.productId);
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid product ID",
        });
      }

      const deleted = await productService.deleteProduct(productId);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      res.json({
        success: true,
        message: "Product deleted successfully",
      });
    } catch (error) {
      logger.error("[ProductController] deleteProduct failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to delete product",
      });
    }
  }

  // ============================================================================
  // PRICE SCRAPING
  // ============================================================================

  async scrapeProduct(req: Request, res: Response) {
    try {
      const { url } = req.body;

      if (!url || typeof url !== "string") {
        return res.status(400).json({
          success: false,
          error: "Product URL is required",
        });
      }

      const humanized = parseBoolean(req.body.humanized) ?? true;

      logger.info(`Scraping product from URL: ${url}`);

      const result = await scrapingOrchestrator.scrapeAndSaveProduct(url, {
        humanized,
        productData: req.body.productData,
      });

      res.json({
        success: true,
        data: {
          product: result.product,
          scrapedData: result.scrapedData,
        },
      });
    } catch (error) {
      logger.error("[ProductController] scrapeProduct failed", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to scrape product",
      });
    }
  }

  async refreshProduct(req: Request, res: Response) {
    try {
      const productId = Number(req.params.productId);
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid product ID",
        });
      }

      const product = await productService.getProductById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      if (product.sources.length === 0) {
        return res.status(400).json({
          success: false,
          error: "Product has no sources to scrape",
        });
      }

      const humanized = parseBoolean(req.body.humanized) ?? true;

      // Scrape all sources
      const results = [];
      for (const source of product.sources) {
        try {
          const result = await scrapingOrchestrator.scrapeAndSaveProduct(source.url, {
            humanized,
          });
          results.push({
            sourceId: source.id,
            success: true,
            price: result.scrapedData.price,
            availability: result.scrapedData.availability,
          });
        } catch (error) {
          results.push({
            sourceId: source.id,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Fetch updated product
      const updatedProduct = await productService.getProductById(productId);

      res.json({
        success: true,
        data: {
          product: updatedProduct,
          results,
        },
      });
    } catch (error) {
      logger.error("[ProductController] refreshProduct failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to refresh product prices",
      });
    }
  }

  // ============================================================================
  // PRICE HISTORY & COMPARISON
  // ============================================================================

  async getPriceHistory(req: Request, res: Response) {
    try {
      const productSourceId = Number(req.params.sourceId);
      if (!Number.isFinite(productSourceId) || productSourceId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid product source ID",
        });
      }

      const limit = parseNumber(req.query.limit);
      const offset = parseNumber(req.query.offset);

      const startDate = req.query.startDate
        ? new Date(String(req.query.startDate))
        : undefined;
      const endDate = req.query.endDate
        ? new Date(String(req.query.endDate))
        : undefined;

      const result = await productService.getPriceHistory({
        productSourceId,
        startDate,
        endDate,
        limit,
        offset,
      });

      res.json({
        success: true,
        data: result.items,
        meta: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error) {
      logger.error("[ProductController] getPriceHistory failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch price history",
      });
    }
  }

  async getPriceComparison(req: Request, res: Response) {
    try {
      const productId = Number(req.params.productId);
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid product ID",
        });
      }

      const comparison = await productService.getPriceComparison(productId);
      if (!comparison) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      res.json({
        success: true,
        data: comparison,
      });
    } catch (error) {
      logger.error("[ProductController] getPriceComparison failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch price comparison",
      });
    }
  }

  async getPriceStatistics(req: Request, res: Response) {
    try {
      const productSourceId = Number(req.params.sourceId);
      if (!Number.isFinite(productSourceId) || productSourceId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid product source ID",
        });
      }

      const days = parseNumber(req.query.days) || 30;

      // This endpoint is deprecated - prices are now per variant
      // For backward compatibility, return empty stats
      const stats = null;

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error("[ProductController] getPriceStatistics failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch price statistics",
      });
    }
  }

  // ============================================================================
  // PRICE ALERTS
  // ============================================================================

  async createPriceAlert(req: Request, res: Response) {
    try {
      const productId = Number(req.params.productId);
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid product ID",
        });
      }

      const {
        type,
        name,
        description,
        targetPrice,
        percentageThreshold,
        notifyEmail,
        notifyWebhook,
        webhookUrl,
        expiresAt,
      } = req.body;

      if (!name || typeof name !== "string") {
        return res.status(400).json({
          success: false,
          error: "Alert name is required",
        });
      }

      if (!type || typeof type !== "string") {
        return res.status(400).json({
          success: false,
          error: "Alert type is required",
        });
      }

      // Get product to find merged product ID
      const product = await productService.getProductById(productId);
      if (!product) {
        return res.status(404).json({
          success: false,
          error: "Product not found",
        });
      }

      if (!product.mergedProductId) {
        return res.status(400).json({
          success: false,
          error: "Product must be part of a merged product to create alerts",
        });
      }

      const alert = await productService.createPriceAlert({
        mergedProductId: product.mergedProductId,
        variantId: product.variant?.id || null,
        userId: null, // TODO: Get from auth context
        type: type as "below_price" | "percentage_drop" | "back_in_stock" | "price_error",
        name,
        description: description || null,
        targetPrice: targetPrice || null,
        percentageThreshold: percentageThreshold || null,
        notifyEmail: notifyEmail ?? true,
        notifyWebhook: notifyWebhook ?? false,
        webhookUrl: webhookUrl || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      });

      res.status(201).json({
        success: true,
        data: alert,
      });
    } catch (error) {
      logger.error("[ProductController] createPriceAlert failed", error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to create price alert",
      });
    }
  }

  async getProductAlerts(req: Request, res: Response) {
    try {
      const productId = Number(req.params.productId);
      if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid product ID",
        });
      }

      // Get product to find merged product ID
      const product = await productService.getProductById(productId);
      if (!product || !product.mergedProductId) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const alerts = await productService.getActiveAlerts(product.mergedProductId);

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      logger.error("[ProductController] getProductAlerts failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch price alerts",
      });
    }
  }
}

export const productController = new ProductController();
