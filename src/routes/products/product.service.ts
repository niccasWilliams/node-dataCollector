import { logger } from "@/utils/logger";
import { RetryService, RetryPresets } from "@/services/retry";
import type {
  Product,
  ProductInsert,
  ProductSource,
  ProductSourceInsert,
  ProductPrice,
  ProductPriceInsert,
  PriceHistoryInsert,
  PriceAlert,
  PriceAlertInsert,
  MergedProduct,
} from "@/db/individual/individual-schema";
import * as productRepo from "./product.repository";

/**
 * Product Service
 * Business logic layer for product and price management
 */
export class ProductService {
  private retryService: RetryService;

  constructor() {
    this.retryService = new RetryService(RetryPresets.database);
  }

  // ============================================================================
  // PRODUCT MANAGEMENT
  // ============================================================================

  /**
   * Create a new product
   */
  async createProduct(data: ProductInsert): Promise<Product> {
    logger.info(`Creating product: ${data.name}`);

    // Validate data
    if (!data.name) {
      throw new Error("Product name is required");
    }

    // Check if product with same EAN already exists
    if (data.ean) {
      const existing = await productRepo.getProductByEan(data.ean);
      if (existing) {
        logger.warn(`Product with EAN ${data.ean} already exists (ID: ${existing.id})`);
        throw new Error(`Product with EAN ${data.ean} already exists`);
      }
    }

    return this.retryService.execute(() => productRepo.createProduct(data));
  }

  /**
   * Get product by ID with all sources and prices
   */
  async getProductById(productId: number): Promise<productRepo.ProductWithSources | null> {
    return this.retryService.execute(() => productRepo.getProductById(productId));
  }

  /**
   * Get merged product by ID
   */
  async getMergedProductById(mergedProductId: number): Promise<MergedProduct | null> {
    return this.retryService.execute(() => productRepo.getMergedProductById(mergedProductId));
  }

  /**
   * Get product by EAN
   */
  async getProductByEan(ean: string): Promise<Product | null> {
    return this.retryService.execute(() => productRepo.getProductByEan(ean));
  }

  /**
   * Get product by ASIN
   */
  async getProductByAsin(asin: string): Promise<Product | null> {
    return this.retryService.execute(() => productRepo.getProductByAsin(asin));
  }

  /**
   * Get product source by related website page
   */
  async getProductSourceByPageId(pageId: number): Promise<ProductSource | null> {
    return this.retryService.execute(() => productRepo.getProductSourceByPageId(pageId));
  }

  /**
   * List products with filtering
   */
  async listProducts(
    params: productRepo.ProductListParams = {}
  ): Promise<productRepo.ProductListResult> {
    return this.retryService.execute(() => productRepo.listProducts(params));
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: number,
    data: Partial<ProductInsert>
  ): Promise<Product | null> {
    logger.info(`Updating product ${productId}`);

    // If EAN is being updated, check for conflicts
    if (data.ean) {
      const existing = await productRepo.getProductByEan(data.ean);
      if (existing && existing.id !== productId) {
        throw new Error(`Product with EAN ${data.ean} already exists`);
      }
    }

    return this.retryService.execute(() =>
      productRepo.updateProduct(productId, data)
    );
  }

  /**
   * Delete product
   */
  async deleteProduct(productId: number): Promise<boolean> {
    logger.info(`Deleting product ${productId}`);
    return this.retryService.execute(() => productRepo.deleteProduct(productId));
  }

  // ============================================================================
  // PRODUCT SOURCE MANAGEMENT
  // ============================================================================

  /**
   * Add a new source for a product
   */
  async addProductSource(data: ProductSourceInsert): Promise<ProductSource> {
    logger.info(
      `Adding source for product ${data.productId} at page ${data.websitePageId}`
    );

    // Validate product exists
    const product = await productRepo.getProductById(data.productId);
    if (!product) {
      throw new Error(`Product ${data.productId} not found`);
    }

    return this.retryService.execute(() => productRepo.createProductSource(data));
  }

  /**
   * Get all sources for a product
   */
  async getProductSources(productId: number): Promise<ProductSource[]> {
    return this.retryService.execute(() => productRepo.getProductSources(productId));
  }

  /**
   * Update product source
   */
  async updateProductSource(
    sourceId: number,
    data: Partial<ProductSourceInsert>
  ): Promise<ProductSource | null> {
    logger.info(`Updating product source ${sourceId}`);
    return this.retryService.execute(() =>
      productRepo.updateProductSource(sourceId, data)
    );
  }

  // ============================================================================
  // PRICE MANAGEMENT
  // ============================================================================

  /**
   * Update price for a VARIANT+SOURCE combination (NEW!)
   * This is now the main method for saving prices
   * Automatically records price history and checks alerts
   */
  async updatePriceForVariant(
    variantId: number,
    productSourceId: number,
    priceData: Omit<ProductPriceInsert, "variantId" | "productSourceId">
  ): Promise<{
    currentPrice: ProductPrice;
    priceChanged: boolean;
    triggeredAlerts?: PriceAlert[];
  }> {
    logger.info(`Updating price for variant ${variantId}, source ${productSourceId}: €${priceData.price}`);

    // Get current price to detect changes
    const currentPrice = await productRepo.getCurrentPrice(variantId, productSourceId);

    const priceChanged = currentPrice
      ? currentPrice.price !== priceData.price.toString()
      : false;

    let priceDelta: string | null = null;
    let percentageChange: string | null = null;

    if (priceChanged && currentPrice) {
      const oldPrice = Number(currentPrice.price);
      const newPrice = Number(priceData.price);
      priceDelta = (newPrice - oldPrice).toFixed(2);
      percentageChange = (((newPrice - oldPrice) / oldPrice) * 100).toFixed(2);

      logger.info(
        `Price changed: €${oldPrice} → €${newPrice} (${percentageChange > "0" ? "+" : ""}${percentageChange}%)`
      );
    }

    // Update current price
    const updatedPrice = await this.retryService.execute(() =>
      productRepo.upsertProductPrice({
        variantId,
        productSourceId,
        ...priceData,
      })
    );

    // Record in price history if price changed or it's a new price
    if (priceChanged || !currentPrice) {
      const historyData: PriceHistoryInsert = {
        variantId,
        productSourceId,
        price: priceData.price,
        currency: priceData.currency ?? "EUR",
        originalPrice: priceData.originalPrice ?? null,
        discountPercentage: priceData.discountPercentage ?? null,
        availability: priceData.availability ?? "unknown",
        stockQuantity: priceData.stockQuantity ?? null,
        priceChanged,
        priceDelta,
        percentageChange,
        metadata: priceData.metadata ?? {},
      };

      await this.retryService.execute(() => productRepo.addPriceHistory(historyData));
    } else {
      const updatedHistory = await this.retryService.execute(() =>
        productRepo.updateLatestPriceHistory(variantId, productSourceId, {
          price: priceData.price,
          ...(priceData.currency !== undefined ? { currency: priceData.currency } : {}),
          ...(priceData.originalPrice !== undefined ? { originalPrice: priceData.originalPrice ?? null } : {}),
          ...(priceData.discountPercentage !== undefined
            ? { discountPercentage: priceData.discountPercentage }
            : {}),
          ...(priceData.availability !== undefined ? { availability: priceData.availability } : {}),
          ...(priceData.stockQuantity !== undefined ? { stockQuantity: priceData.stockQuantity } : {}),
          ...(priceData.metadata !== undefined && priceData.metadata !== null
            ? { metadata: priceData.metadata as Record<string, unknown> }
            : {}),
        })
      );

      if (!updatedHistory) {
        const fallbackHistory: PriceHistoryInsert = {
          variantId,
          productSourceId,
          price: priceData.price,
          currency: priceData.currency ?? "EUR",
          originalPrice: priceData.originalPrice ?? null,
          discountPercentage: priceData.discountPercentage ?? null,
          availability: priceData.availability ?? "unknown",
          stockQuantity: priceData.stockQuantity ?? null,
          priceChanged: false,
          priceDelta: null,
          percentageChange: null,
          metadata: priceData.metadata ?? {},
        };

        await this.retryService.execute(() => productRepo.addPriceHistory(fallbackHistory));
      }
    }

    // Check and trigger alerts if price changed
    // TODO: Implement variant-aware alert checking
    let triggeredAlerts: PriceAlert[] | undefined = undefined;

    return {
      currentPrice: updatedPrice,
      priceChanged,
      triggeredAlerts,
    };
  }

  /**
   * Update price for a product source (DEPRECATED - use updatePriceForVariant instead)
   * Kept for backward compatibility during migration
   */
  async updatePrice(
    productSourceId: number,
    priceData: Omit<ProductPriceInsert, "productSourceId">
  ): Promise<{
    currentPrice: ProductPrice;
    priceChanged: boolean;
    triggeredAlerts: PriceAlert[];
  }> {
    throw new Error(
      "updatePrice is deprecated - use updatePriceForVariant instead. Prices must be saved per variant+source."
    );
  }

  /**
   * Get price comparison across all sources
   */
  async getPriceComparison(
    productId: number
  ): Promise<productRepo.PriceComparisonResult | null> {
    return this.retryService.execute(() => productRepo.getPriceComparison(productId));
  }

  /**
   * Get price history for a product source
   */
  async getPriceHistory(
    params: productRepo.PriceHistoryParams
  ): Promise<productRepo.PriceHistoryResult> {
    return this.retryService.execute(() => productRepo.getPriceHistory(params));
  }

  /**
   * Get price statistics for a variant+source
   */
  async getPriceStatistics(variantId: number, productSourceId: number, days: number = 30) {
    return this.retryService.execute(() =>
      productRepo.getPriceStatistics(variantId, productSourceId, days)
    );
  }

  // ============================================================================
  // PRICE ALERTS
  // ============================================================================

  /**
   * Create a price alert
   */
  async createPriceAlert(data: PriceAlertInsert): Promise<PriceAlert> {
    const targetInfo = data.mergedProductId
      ? `merged product ${data.mergedProductId}`
      : `variant ${data.variantId}`;
    logger.info(`Creating price alert for ${targetInfo}: ${data.name}`);

    // Validate data
    if (!data.name) {
      throw new Error("Alert name is required");
    }

    if (!data.mergedProductId && !data.variantId) {
      throw new Error("Either mergedProductId or variantId is required");
    }

    if (data.type === "below_price" && !data.targetPrice) {
      throw new Error("Target price is required for 'below_price' alert");
    }

    if (data.type === "percentage_drop" && !data.percentageThreshold) {
      throw new Error("Percentage threshold is required for 'percentage_drop' alert");
    }

    // Validate merged product or variant exists
    if (data.mergedProductId) {
      const mergedProduct = await productRepo.getMergedProductById(data.mergedProductId);
      if (!mergedProduct) {
        throw new Error(`Merged product ${data.mergedProductId} not found`);
      }
    }

    return this.retryService.execute(() => productRepo.createPriceAlert(data));
  }

  /**
   * Get active alerts for a merged product
   */
  async getActiveAlerts(mergedProductId: number): Promise<PriceAlert[]> {
    return this.retryService.execute(() => productRepo.getActiveAlerts(mergedProductId));
  }

  /**
   * Check if alerts should be triggered and trigger them (DEPRECATED)
   * TODO: Implement variant-aware alert checking
   */
  private async checkAndTriggerAlerts(
    mergedProductId: number,
    currentPrice: number
  ): Promise<PriceAlert[]> {
    const activeAlerts = await productRepo.getActiveAlerts(mergedProductId);
    const triggeredAlerts: PriceAlert[] = [];

    for (const alert of activeAlerts) {
      let shouldTrigger = false;

      switch (alert.type) {
        case "below_price":
          if (alert.targetPrice && currentPrice < Number(alert.targetPrice)) {
            shouldTrigger = true;
            logger.info(
              `Alert triggered: Price €${currentPrice} is below target €${alert.targetPrice}`
            );
          }
          break;

        case "price_error":
          // Check if price is suspiciously low (less than 50% of average)
          // This would require historical data - simplified for now
          if (currentPrice < 10) {
            // Basic check for very low prices
            shouldTrigger = true;
            logger.warn(`Possible price error detected: €${currentPrice}`);
          }
          break;

        case "back_in_stock":
          // This would be triggered by availability change, handled separately
          break;

        case "percentage_drop":
          // This requires historical price data to calculate
          // Simplified for now - would need to fetch recent price history
          break;
      }

      if (shouldTrigger) {
        const triggered = await productRepo.triggerAlert(
          alert.id,
          currentPrice.toFixed(2)
        );
        if (triggered) {
          triggeredAlerts.push(triggered);
          // TODO: Send notifications (email, webhook, etc.)
          await this.sendAlertNotification(triggered, currentPrice);
        }
      }
    }

    return triggeredAlerts;
  }

  /**
   * Send alert notification
   * TODO: Implement actual notification sending (email, webhook, etc.)
   */
  private async sendAlertNotification(
    alert: PriceAlert,
    currentPrice: number
  ): Promise<void> {
    logger.info(
      `📢 ALERT: ${alert.name} - Price: €${currentPrice} (Alert ID: ${alert.id})`
    );

    // TODO: Implement email notification
    if (alert.notifyEmail) {
      logger.debug("Would send email notification");
    }

    // TODO: Implement webhook notification
    if (alert.notifyWebhook && alert.webhookUrl) {
      logger.debug(`Would send webhook to: ${alert.webhookUrl}`);
    }
  }

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  /**
   * Validate EAN format
   */
  validateEan(ean: string): boolean {
    // Basic EAN-13 validation (13 digits)
    if (!/^\d{13}$/.test(ean)) {
      return false;
    }

    // Check EAN-13 checksum
    const digits = ean.split("").map(Number);
    const checksum = digits.pop()!;
    const sum = digits.reduce((acc, digit, index) => {
      return acc + digit * (index % 2 === 0 ? 1 : 3);
    }, 0);
    const calculatedChecksum = (10 - (sum % 10)) % 10;

    return checksum === calculatedChecksum;
  }

  /**
   * Detect price errors
   * Returns true if price seems suspicious
   */
  detectPriceError(price: number, stats?: { avgPrice?: string; minPrice?: string }): boolean {
    // Price too low (less than €1)
    if (price < 1) {
      return true;
    }

    // Price significantly lower than historical average
    if (stats?.avgPrice && price < Number(stats.avgPrice) * 0.3) {
      return true;
    }

    return false;
  }
}

// Export singleton instance
export const productService = new ProductService();
