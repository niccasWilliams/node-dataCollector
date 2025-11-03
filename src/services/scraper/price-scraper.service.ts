import type { Page } from "patchright";
import { logger } from "@/utils/logger";
import { RetryService, RetryPresets } from "@/services/retry";
import type { ProductAvailability } from "@/db/individual/individual-schema";

/**
 * Scraped product data
 */
export interface ScrapedProductData {
  // Product Information
  name: string | null;
  price: number | null;
  currency: string;
  originalPrice: number | null; // Crossed-out price
  discountPercentage: number | null;

  // Availability
  availability: ProductAvailability;
  stockQuantity: number | null;

  // Product Details
  ean: string | null;
  asin: string | null; // Amazon specific
  brand: string | null;
  model: string | null;
  imageUrl: string | null;
  description: string | null;

  // Shipping
  shippingCost: number | null;

  // Metadata
  metadata: Record<string, unknown>;
  scrapedAt: Date;
  url: string;
}

/**
 * Scraper configuration for a specific shop/page
 */
export interface ScraperConfig {
  // CSS Selectors
  priceSelector?: string;
  originalPriceSelector?: string;
  titleSelector?: string;
  availabilitySelector?: string;
  eanSelector?: string;
  asinSelector?: string;
  brandSelector?: string;
  imageSelector?: string;
  descriptionSelector?: string;
  shippingSelector?: string;

  // Availability mapping
  availabilityMapping?: Record<string, ProductAvailability>;

  // Wait conditions
  waitForSelector?: string;
  waitTime?: number;

  // Custom extraction functions (override selectors)
  customExtractors?: {
    price?: (page: Page) => Promise<number | null>;
    availability?: (page: Page) => Promise<ProductAvailability>;
    ean?: (page: Page) => Promise<string | null>;
    asin?: (page: Page) => Promise<string | null>;
    brand?: (page: Page) => Promise<string | null>;
    title?: (page: Page) => Promise<string | null>;
    description?: (page: Page) => Promise<string | null>;
    image?: (page: Page) => Promise<string | null>;
    [key: string]: ((page: Page) => Promise<any>) | undefined;
  };
}

/**
 * Shop adapter interface
 * Each shop (Amazon, MediaMarkt, etc.) should implement this
 */
export interface ShopAdapter {
  name: string;
  domains: string[];
  getConfig(url: string): ScraperConfig;
  canHandle(url: string): boolean;
}

/**
 * Generic Price Scraper Service
 * Works with any shop via adapters or custom selectors
 */
export class PriceScraperService {
  private retryService: RetryService;
  private adapters: Map<string, ShopAdapter> = new Map();

  constructor() {
    this.retryService = new RetryService(RetryPresets.scraping);
  }

  /**
   * Register a shop adapter
   */
  registerAdapter(adapter: ShopAdapter): void {
    for (const domain of adapter.domains) {
      this.adapters.set(domain, adapter);
      logger.debug(`Registered adapter ${adapter.name} for domain ${domain}`);
    }
  }

  /**
   * Get adapter for URL
   */
  private getAdapterForUrl(url: string): ShopAdapter | null {
    try {
      const urlObj = new URL(url);
      const domain = urlObj.hostname;

      // Try exact match
      if (this.adapters.has(domain)) {
        return this.adapters.get(domain)!;
      }

      // Try domain without www
      const domainWithoutWww = domain.replace(/^www\./, "");
      if (this.adapters.has(domainWithoutWww)) {
        return this.adapters.get(domainWithoutWww)!;
      }

      // Try checking if any adapter can handle
      for (const adapter of this.adapters.values()) {
        if (adapter.canHandle(url)) {
          return adapter;
        }
      }
    } catch (error) {
      logger.error(`Failed to parse URL: ${url}`, error);
    }

    return null;
  }

  /**
   * Scrape product data from a page
   */
  async scrape(
    page: Page,
    url: string,
    customConfig?: ScraperConfig
  ): Promise<ScrapedProductData> {
    logger.info(`Scraping product from: ${url}`);

    // Get config from adapter or use custom config
    let config: ScraperConfig = customConfig || {};
    const adapter = this.getAdapterForUrl(url);
    if (adapter) {
      logger.debug(`Using adapter: ${adapter.name}`);
      config = { ...adapter.getConfig(url), ...customConfig };
    }

    return this.retryService.execute(async () => {
      // Wait for page to load
      if (config.waitForSelector) {
        await page.waitForSelector(config.waitForSelector, { timeout: 10000 });
      } else if (config.waitTime) {
        await page.waitForTimeout(config.waitTime);
      }

      // Extract data
      const data: ScrapedProductData = {
        name: await this.extractText(page, config.titleSelector, config.customExtractors?.title),
        price: await this.extractPrice(page, config.priceSelector, config.customExtractors?.price),
        currency: "EUR", // Default, could be extracted
        originalPrice: await this.extractPrice(page, config.originalPriceSelector),
        discountPercentage: null, // Calculated later
        availability: await this.extractAvailability(
          page,
          config.availabilitySelector,
          config.availabilityMapping,
          config.customExtractors?.availability
        ),
        stockQuantity: null,
        ean: await this.extractText(page, config.eanSelector, config.customExtractors?.ean),
        asin: await this.extractText(page, config.asinSelector, config.customExtractors?.asin),
        brand: await this.extractText(page, config.brandSelector, config.customExtractors?.brand),
        model: null,
        imageUrl: await this.extractImage(page, config.imageSelector, config.customExtractors?.image),
        description: await this.extractText(page, config.descriptionSelector, config.customExtractors?.description),
        shippingCost: await this.extractPrice(page, config.shippingSelector),
        metadata: {},
        scrapedAt: new Date(),
        url,
      };

      // Calculate discount percentage
      if (data.price && data.originalPrice && data.originalPrice > data.price) {
        data.discountPercentage = Number(
          (((data.originalPrice - data.price) / data.originalPrice) * 100).toFixed(2)
        );
      }

      logger.info(
        `Scraped: ${data.name?.substring(0, 50)}... - €${data.price} (${data.availability})`
      );

      return data;
    });
  }

  /**
   * Extract text from element
   */
  private async extractText(
    page: Page,
    selector?: string,
    customExtractor?: (page: Page) => Promise<string | null>
  ): Promise<string | null> {
    try {
      if (customExtractor) {
        logger.debug('[PriceScraper] Using custom extractor');
        const result = await customExtractor(page);
        logger.debug(`[PriceScraper] Custom extractor result: ${result}`);
        return result;
      }

      if (!selector) {
        return null;
      }

      const element = await page.$(selector);
      if (!element) {
        logger.debug(`[PriceScraper] Element not found for selector: ${selector}`);
        return null;
      }

      const text = await element.textContent();
      const result = text ? text.trim() : null;
      logger.debug(`[PriceScraper] Extracted text from selector ${selector}: ${result}`);
      return result;
    } catch (error) {
      logger.debug(`Failed to extract text with selector ${selector}:`, error);
      return null;
    }
  }

  /**
   * Extract price from element
   * Handles various price formats: €99.99, 99,99 €, $99.99, etc.
   */
  private async extractPrice(
    page: Page,
    selector?: string,
    customExtractor?: (page: Page) => Promise<number | null>
  ): Promise<number | null> {
    try {
      if (customExtractor) {
        return await customExtractor(page);
      }

      if (!selector) {
        return null;
      }

      const element = await page.$(selector);
      if (!element) {
        return null;
      }

      const text = await element.textContent();
      if (!text) {
        return null;
      }

      // Remove currency symbols and extract number
      // Handles: €99.99, 99,99 €, $99.99, 99.99, 1.299,99 €
      const cleaned = text
        .replace(/[€$£¥]|\s|EUR|USD|GBP/gi, "")
        .trim();

      // Handle German format (1.299,99) vs English format (1,299.99)
      let number: number;
      if (cleaned.includes(",") && cleaned.includes(".")) {
        // Has both - determine which is decimal separator
        const lastComma = cleaned.lastIndexOf(",");
        const lastDot = cleaned.lastIndexOf(".");
        if (lastComma > lastDot) {
          // German format: 1.299,99
          number = Number(cleaned.replace(/\./g, "").replace(",", "."));
        } else {
          // English format: 1,299.99
          number = Number(cleaned.replace(/,/g, ""));
        }
      } else if (cleaned.includes(",")) {
        // Only comma - likely German decimal: 99,99
        number = Number(cleaned.replace(",", "."));
      } else {
        // Only dots or plain number: 99.99 or 99
        number = Number(cleaned);
      }

      return isNaN(number) ? null : number;
    } catch (error) {
      logger.debug(`Failed to extract price with selector ${selector}:`, error);
      return null;
    }
  }

  /**
   * Extract image URL
   */
  private async extractImage(
    page: Page,
    selector?: string,
    customExtractor?: (page: Page) => Promise<string | null>
  ): Promise<string | null> {
    try {
      if (customExtractor) {
        return await customExtractor(page);
      }

      if (!selector) {
        return null;
      }

      const imageUrl = await page.evaluate((sel) => {
        if (typeof window !== "undefined" && typeof (window as any).__name !== "function") {
          (window as any).__name = function (target: any, value: string) {
            try {
              Object.defineProperty(target, "name", { value, configurable: true });
            } catch {
              // ignore
            }
            return target;
          };
        }
        if (typeof __name !== "function" && typeof window !== "undefined" && typeof (window as any).__name === "function") {
          var __name = (window as any).__name;
        }
        const element = document.querySelector(sel);
        if (!element) {
          return null;
        }

        const getCleanValue = (value: string | null | undefined): string | null => {
          if (!value) return null;
          return value.trim() || null;
        };

        const attributesToCheck = [
          "src",
          "data-old-hires",
          "data-default-src",
          "data-src",
          "data-lazy-src",
          "data-hires",
        ];

        for (const attr of attributesToCheck) {
          const value = getCleanValue(element.getAttribute(attr));
          if (value) {
            return value;
          }
        }

        const dynamicImage = element.getAttribute("data-a-dynamic-image");
        if (dynamicImage) {
          try {
            const parsed = JSON.parse(dynamicImage) as Record<string, unknown>;
            const firstKey = Object.keys(parsed)[0];
            if (firstKey) {
              return firstKey;
            }
          } catch {
            // Ignore JSON parse errors
          }
        }

        if (element instanceof HTMLImageElement) {
          const currentSrc = getCleanValue(element.currentSrc);
          if (currentSrc) {
            return currentSrc;
          }
        }

        return null;
      }, selector);

      return imageUrl || null;
    } catch (error) {
      logger.debug(`Failed to extract image with selector ${selector}:`, error);
      return null;
    }
  }

  /**
   * Extract availability status
   */
  private async extractAvailability(
    page: Page,
    selector?: string,
    mapping?: Record<string, ProductAvailability>,
    customExtractor?: (page: Page) => Promise<ProductAvailability>
  ): Promise<ProductAvailability> {
    try {
      if (customExtractor) {
        return await customExtractor(page);
      }

      if (!selector) {
        return "unknown";
      }

      const element = await page.$(selector);
      if (!element) {
        return "unknown";
      }

      const text = await element.textContent();
      if (!text) {
        return "unknown";
      }

      const lowerText = text.toLowerCase().trim();

      // Use custom mapping if provided
      if (mapping) {
        for (const [pattern, status] of Object.entries(mapping)) {
          if (lowerText.includes(pattern.toLowerCase())) {
            return status;
          }
        }
      }

      // Default availability detection (German & English)
      if (
        lowerText.includes("auf lager") ||
        lowerText.includes("verfügbar") ||
        lowerText.includes("in stock") ||
        lowerText.includes("available")
      ) {
        return "in_stock";
      }

      if (
        lowerText.includes("nicht verfügbar") ||
        lowerText.includes("ausverkauft") ||
        lowerText.includes("out of stock") ||
        lowerText.includes("sold out")
      ) {
        return "out_of_stock";
      }

      if (
        lowerText.includes("vorbestellung") ||
        lowerText.includes("pre-order") ||
        lowerText.includes("preorder")
      ) {
        return "preorder";
      }

      if (
        lowerText.includes("wenige") ||
        lowerText.includes("begrenzt") ||
        lowerText.includes("limited") ||
        lowerText.includes("only") ||
        lowerText.includes("few")
      ) {
        return "limited_stock";
      }

      return "unknown";
    } catch (error) {
      logger.debug(`Failed to extract availability with selector ${selector}:`, error);
      return "unknown";
    }
  }

  /**
   * Validate scraped data
   */
  validateData(data: ScrapedProductData): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name) {
      errors.push("Product name is missing");
    }

    if (data.price === null) {
      errors.push("Price is missing");
    }

    if (data.price !== null && data.price < 0) {
      errors.push("Price cannot be negative");
    }

    if (data.price !== null && data.price < 0.01) {
      errors.push("Price suspiciously low (possible scraping error)");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const priceScraperService = new PriceScraperService();
