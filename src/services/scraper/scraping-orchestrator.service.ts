import { logger } from "@/utils/logger";
import { browserHandler } from "@/services/browser/browser.handler";
import { priceScraperService, type ScrapedProductData, type ScraperConfig } from "./price-scraper.service";
import { AmazonAdapter } from "./adapters/amazon.adapter";
import { MediaMarktAdapter } from "./adapters/mediamarkt.adapter";
import { productService } from "@/routes/products";
import type { ProductInsert, ProductSourceInsert, ProductPrice } from "@/db/individual/individual-schema";
import * as websiteRepo from "@/routes/websites/website.repository";
import type * as productRepo from "@/routes/products/product.repository";
import { productMatchingService } from "@/services/matching/product-matching.service";
import { attributeExtractorService } from "@/services/matching/attribute-extractor.service";

/**
 * Scraping Orchestrator
 * High-level service that coordinates browser automation, price scraping, and data storage
 */
export class ScrapingOrchestrator {
  private registered = false;

  constructor() {
    this.registerAdapters();
  }

  /**
   * Register all shop adapters
   */
  private registerAdapters(): void {
    if (this.registered) return;

    priceScraperService.registerAdapter(new AmazonAdapter());
    priceScraperService.registerAdapter(new MediaMarktAdapter());

    this.registered = true;
    logger.info("Registered all shop adapters");
  }

  /**
   * Scrape a product from URL and save to database
   * This is the main entry point for scraping
   */
  async scrapeAndSaveProduct(
    url: string,
    options?: {
      customConfig?: ScraperConfig;
      productData?: Partial<ProductInsert>;
      sessionId?: string;
      humanized?: boolean;
    }
  ): Promise<{
    product: productRepo.ProductWithSources;
    scrapedData: ScrapedProductData;
    sessionId: string;
  }> {
    logger.info(`Starting product scrape and save for: ${url}`);

    const humanized = options?.humanized !== false; // Default to true

    let sessionId: string | undefined;
    let createdSession = false;

    try {
      // Create browser session if not provided
      if (options?.sessionId) {
        sessionId = options.sessionId;
      } else {
        const session = await browserHandler.createSession({
          headless: true,
          humanizedInteractions: humanized,
        });
        sessionId = session.id.toString();
        createdSession = true;
        logger.debug(`Created browser session: ${sessionId}`);
      }

      if (!sessionId) {
        throw new Error("Browser session could not be established");
      }

      const activeSessionId = sessionId;

      // Navigate to URL
      await browserHandler.navigate(activeSessionId, url);
      logger.debug(`Navigated to: ${url}`);

      // Get page HTML to ensure it's loaded
      const html = await browserHandler.getHTML(activeSessionId);
      const pageInfo = await browserHandler.getPageInfo(activeSessionId);

      // For scraping, we'll need to access the page differently
      // Using evaluate instead of direct page access
      const page = await (async () => {
        // This is a workaround - we use the browser handler methods instead of direct page access
        // The page is only accessible internally to BrowserService
        return {
          url: () => pageInfo.url,
          $: async (selector: string) => {
            const exists = await browserHandler.evaluate<boolean>(
              activeSessionId,
              (sel: string) => document.querySelector(sel) !== null,
              selector
            );
            if (!exists) return null;
            return {
              textContent: async () => {
                return browserHandler.evaluate<string | null>(
                  activeSessionId,
                  (sel: string) => document.querySelector(sel)?.textContent || null,
                  selector
                );
              },
              getAttribute: async (attr: string) => {
                return browserHandler.evaluate<string | null>(
                  activeSessionId,
                  (sel: string, attribute: string) => document.querySelector(sel)?.getAttribute(attribute) || null,
                  selector,
                  attr
                );
              },
            };
          },
          evaluate: async (fn: any, ...args: any[]) => {
            return browserHandler.evaluate(activeSessionId, fn, ...args);
          },
          waitForSelector: async (selector: string, options?: any) => {
            await browserHandler.waitForSelector(activeSessionId, selector, options);
          },
          waitForTimeout: async (ms: number) => {
            await new Promise((resolve) => setTimeout(resolve, ms));
          },
        };
      })();

      if (!page) {
        throw new Error(`Failed to get page for session ${activeSessionId}`);
      }

      // Scrape the data
      const scrapedData = await priceScraperService.scrape(page as any, url, options?.customConfig);

      // Validate scraped data
      const validation = priceScraperService.validateData(scrapedData);
      if (!validation.valid) {
        logger.warn(`Scraped data validation failed: ${validation.errors.join(", ")}`);
      }

      // Take screenshot for verification
      await browserHandler.screenshot(activeSessionId, {
        path: `screenshots/products/${Date.now()}-${activeSessionId}.png`,
      });

      // Store website snapshot
      const snapshot = await websiteRepo.storeWebsiteSnapshot({
        url,
        title: scrapedData.name || undefined,
        elements: [], // Could extract elements if needed
      });
      logger.debug(`Stored website snapshot: ${snapshot.websiteId}/${snapshot.pageId}`);

      // ========== NEW WORKFLOW: ALWAYS CREATE/FIND MERGED PRODUCT + VARIANT ==========

      // Step 1: Check if we already have a product source for this page
      let product: productRepo.ProductWithSources | null = null;
      const existingSourceForPage = await productService.getProductSourceByPageId(snapshot.pageId);

      if (existingSourceForPage) {
        product = await productService.getProductById(existingSourceForPage.productId);
        if (product) {
          logger.info(`Found existing product by source page: ${product.id}`);
        }
      }

      // Step 2: If no product for this page, search by identifiers (EAN/ASIN)
      if (!product && scrapedData.ean) {
        const existingProduct = await productService.getProductByEan(scrapedData.ean);
        if (existingProduct) {
          product = await productService.getProductById(existingProduct.id);
          logger.info(`Found existing product by EAN: ${existingProduct.id}`);
        }
      }

      if (!product && scrapedData.asin) {
        const existingProduct = await productService.getProductByAsin(scrapedData.asin);
        if (existingProduct) {
          product = await productService.getProductById(existingProduct.id);
          logger.info(`Found existing product by ASIN: ${existingProduct.id}`);
        }
      }

      // Step 3: If still no product, create new one
      if (!product) {
        const productData: ProductInsert = {
          name: scrapedData.name ?? options?.productData?.name ?? "Unknown Product",
          ean: scrapedData.ean ?? options?.productData?.ean ?? null,
          asin: scrapedData.asin ?? options?.productData?.asin ?? null,
          brand: scrapedData.brand ?? options?.productData?.brand ?? null,
          model: options?.productData?.model ?? null,
          category: options?.productData?.category ?? null,
          imageUrl: scrapedData.imageUrl ?? options?.productData?.imageUrl ?? null,
          description: scrapedData.description ?? options?.productData?.description ?? null,
          metadata: {
            ...(options?.productData?.metadata ?? {}),
            ...scrapedData.metadata,
          },
        };

        const createdProduct = await productService.createProduct(productData);
        product = await productService.getProductById(createdProduct.id);
        logger.info(`Created new product: ${createdProduct.id}`);
      }

      if (!product) {
        throw new Error("Failed to create/get product");
      }

      // Step 4: Ensure product has a merged product (ALWAYS!)
      // This will either find existing merged product or create new one
      let mergedProductId = product.mergedProductId;

      if (!mergedProductId) {
        // Try to find matches first (by EAN, ASIN, or fuzzy name)
        const matches = await productMatchingService.findMatches(product.id);

        if (matches.length > 0) {
          const topMatch = matches[0];

          // Lower threshold for same-shop products (likely variants)
          // Higher threshold for cross-shop matching
          const isSameShop = await (async () => {
            const matchedProduct = await productService.getProductById(topMatch.productId);
            if (!matchedProduct) return false;

            // Check if any source has the same domain
            const currentDomain = new URL(url).hostname;
            return matchedProduct.sources.some(s => {
              try {
                return new URL(s.url).hostname === currentDomain;
              } catch {
                return false;
              }
            });
          })();

          const threshold = isSameShop ? 0.75 : 0.90;

          if (topMatch.confidence >= threshold) {
            // High confidence match found - use that merged product
            const matchedProduct = await productService.getProductById(topMatch.productId);

            if (matchedProduct?.mergedProductId) {
              mergedProductId = matchedProduct.mergedProductId;
              logger.info(
                `Matched to existing merged product ${mergedProductId} (confidence: ${topMatch.confidence}, same-shop: ${isSameShop}, threshold: ${threshold})`
              );
            }
          } else {
            logger.debug(
              `Match found but confidence too low: ${topMatch.confidence} < ${threshold} (same-shop: ${isSameShop})`
            );
          }
        }

        if (mergedProductId) {
          // Update product with merged product ID
          await productService.updateProduct(product.id, { mergedProductId });
          product = (await productService.getProductById(product.id))!;
          logger.debug(`Updated product ${product.id} with mergedProductId ${mergedProductId}`);
        } else {
          // No match - create new merged product
          logger.info(`Creating new merged product for product ${product.id}`);
          // This will be handled by attribute extractor below
        }
      }

      // Check if source already exists for this product and page
      const existingSource = product.sources.find(
        (s) => s.websitePageId === snapshot.pageId
      );

      let sourceId: number;

      if (existingSource) {
        sourceId = existingSource.id;
        logger.debug(`Using existing product source: ${sourceId}`);
      } else {
        // Create product source
        const sourceData: ProductSourceInsert = {
          productId: product.id,
          websitePageId: snapshot.pageId,
          isActive: true,
          lastScrapedAt: new Date(),
          metadata: {},
        };

        const createdSource = await productService.addProductSource(sourceData);
        sourceId = createdSource.id;
        logger.info(`Created product source: ${sourceId}`);
      }

      // Update core product attributes if new information was scraped
      if (product) {
        const updates: Partial<ProductInsert> = {};
        const currentMetadata =
          (product.metadata && typeof product.metadata === "object"
            ? product.metadata
            : {}) as Record<string, unknown>;

        if (!product.ean && scrapedData.ean) {
          updates.ean = scrapedData.ean;
        }
        if (!product.asin && scrapedData.asin) {
          updates.asin = scrapedData.asin;
        }
        if (!product.brand && scrapedData.brand) {
          updates.brand = scrapedData.brand;
        }
        if (!product.description && scrapedData.description) {
          updates.description = scrapedData.description;
        }
        if (scrapedData.imageUrl && scrapedData.imageUrl !== product.imageUrl) {
          updates.imageUrl = scrapedData.imageUrl;
        }
        if (!product.name && scrapedData.name) {
          updates.name = scrapedData.name;
        }
        if (
          scrapedData.name &&
          product.name &&
          options?.productData?.name &&
          product.name === options.productData.name &&
          scrapedData.name !== product.name
        ) {
          updates.name = scrapedData.name;
        }
        if (
          options?.productData?.category &&
          options.productData.category !== product.category
        ) {
          updates.category = options.productData.category;
        }
        const metadataSources: Record<string, unknown>[] = [];
        if (
          scrapedData.metadata &&
          Object.keys(scrapedData.metadata).length > 0
        ) {
          metadataSources.push(scrapedData.metadata);
        }
        if (
          options?.productData?.metadata &&
          Object.keys(options.productData.metadata).length > 0
        ) {
          metadataSources.push(options.productData.metadata as Record<string, unknown>);
        }
        if (metadataSources.length > 0) {
          const mergedMetadata = metadataSources.reduce<Record<string, unknown>>(
            (acc, source) => ({ ...acc, ...source }),
            { ...currentMetadata }
          );
          const metadataChanged =
            Object.keys(mergedMetadata).length !== Object.keys(currentMetadata).length ||
            Object.entries(mergedMetadata).some(
              ([key, value]) => currentMetadata[key] !== value
            );
          if (metadataChanged) {
            updates.metadata = mergedMetadata;
          }
        }

        if (Object.keys(updates).length > 0) {
          await productService.updateProduct(product.id, updates);
          product = await productService.getProductById(product.id);
        }
      }

      if (!product) {
        throw new Error("Product is null after updates");
      }

      // Refresh product data
      const updatedProduct = await productService.getProductById(product.id);
      if (!updatedProduct) {
        throw new Error("Failed to refresh product data");
      }

      // ========== MERGED PRODUCT, VARIANT & ATTRIBUTE EXTRACTION ==========

      try {
        // Extract attributes and create/update merged product + variant
        // This service now handles:
        // 1. Creating merged product if needed
        // 2. Creating/finding variant based on extracted attributes
        // 3. Linking product to merged product and variant
        const productName = updatedProduct.name;
        await attributeExtractorService.extractAndSaveAttributes(
          updatedProduct.id,
          productName,
          scrapedData.metadata
        );
        logger.debug(`Extracted attributes and ensured variant for product ${updatedProduct.id}`);

        // Refresh product to get updated mergedProductId and variant
        const refreshedProduct = await productService.getProductById(updatedProduct.id);
        if (refreshedProduct) {
          // Re-assign to mutable variable
          product = refreshedProduct;
        }
      } catch (error) {
        logger.error(`Failed to extract attributes for product ${updatedProduct.id}:`, error);
      }

      // Get the variant for this product (should exist now after attribute extraction)
      // Use the refreshed product reference
      const finalProduct = product || updatedProduct;
      let variantId: number | null = null;

      if (finalProduct.variant) {
        variantId = finalProduct.variant.id;
        logger.info(
          `Using variant ${variantId} (${finalProduct.variant.label}) for product ${finalProduct.id}`
        );
      } else {
        logger.warn(`No variant found for product ${finalProduct.id} - cannot save price!`);
      }

      // Save price on VARIANT level (new!)
      if (scrapedData.price !== null && variantId) {
        try {
          const priceUpdate = await productService.updatePriceForVariant(variantId, sourceId, {
            price: scrapedData.price.toString(),
            currency: scrapedData.currency,
            originalPrice: scrapedData.originalPrice?.toString(),
            discountPercentage: scrapedData.discountPercentage?.toString(),
            availability: scrapedData.availability,
            shippingCost: scrapedData.shippingCost?.toString(),
            metadata: scrapedData.metadata,
          });

          logger.info(
            `Updated price for variant ${variantId}: €${scrapedData.price} (Changed: ${priceUpdate.priceChanged})`
          );

          if (priceUpdate.triggeredAlerts && priceUpdate.triggeredAlerts.length > 0) {
            logger.info(`🚨 Triggered ${priceUpdate.triggeredAlerts.length} alert(s)!`);
          }
        } catch (error) {
          logger.error(`Failed to update price for variant ${variantId}:`, error);
        }
      }

      // Product matching for suggestions (lower confidence matches)
      try {
        const matches = await productMatchingService.findMatches(updatedProduct.id);

        if (matches.length > 0) {
          // Process matches (create suggestions for manual review)
          // High confidence matches (>90%) were already handled above
          const matchResult = await productMatchingService.processMatches(updatedProduct.id, matches);

          logger.info(
            `Product matching: ${matchResult.autoMerged} auto-merged, ${matchResult.suggestionsCreated} suggestions, ${matchResult.skipped} skipped`
          );
        } else {
          logger.debug(`No additional matches found for product ${updatedProduct.id}`);
        }
      } catch (error) {
        logger.error(`Failed to process product matches for ${updatedProduct.id}:`, error);
      }

      // ==============================================================

      logger.info(`✅ Successfully scraped and saved product ${updatedProduct.id}`);

      return {
        product: updatedProduct,
        scrapedData,
        sessionId: activeSessionId,
      };
    } catch (error) {
      logger.error(`Failed to scrape and save product from ${url}:`, error);
      throw error;
    } finally {
      // Close session if we created it
      if (createdSession && sessionId) {
        try {
          await browserHandler.closeSession(sessionId);
          logger.debug(`Closed browser session: ${sessionId}`);
        } catch (error) {
          logger.error(`Failed to close browser session ${sessionId}:`, error);
        }
      }
    }
  }

  /**
   * Scrape multiple products
   */
  async scrapeMultipleProducts(
    urls: string[],
    options?: {
      customConfig?: ScraperConfig;
      humanized?: boolean;
      parallel?: boolean;
      maxConcurrent?: number;
    }
  ): Promise<{
    successful: Array<{
      url: string;
      product: productRepo.ProductWithSources;
      scrapedData: ScrapedProductData;
    }>;
    failed: Array<{
      url: string;
      error: string;
    }>;
  }> {
    logger.info(`Scraping ${urls.length} products (parallel: ${options?.parallel || false})`);

    const successful: Array<{
      url: string;
      product: productRepo.ProductWithSources;
      scrapedData: ScrapedProductData;
    }> = [];
    const failed: Array<{
      url: string;
      error: string;
    }> = [];

    if (options?.parallel) {
      // Parallel scraping with concurrency limit
      const maxConcurrent = options.maxConcurrent || 3;
      const chunks: string[][] = [];

      for (let i = 0; i < urls.length; i += maxConcurrent) {
        chunks.push(urls.slice(i, i + maxConcurrent));
      }

      for (const chunk of chunks) {
        const results = await Promise.allSettled(
          chunk.map((url) =>
            this.scrapeAndSaveProduct(url, {
              customConfig: options.customConfig,
              humanized: options.humanized,
            })
          )
        );

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          const url = chunk[i];

          if (result.status === "fulfilled") {
            successful.push({
              url,
              product: result.value.product,
              scrapedData: result.value.scrapedData,
            });
          } else {
            failed.push({
              url,
              error: result.reason?.message || "Unknown error",
            });
          }
        }

        // Add delay between chunks to avoid rate limiting
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    } else {
      // Sequential scraping
      for (const url of urls) {
        try {
          const result = await this.scrapeAndSaveProduct(url, {
            customConfig: options?.customConfig,
            humanized: options?.humanized,
          });

          successful.push({
            url,
            product: result.product,
            scrapedData: result.scrapedData,
          });

          // Add delay between requests
          await new Promise((resolve) => setTimeout(resolve, 1500));
        } catch (error) {
          failed.push({
            url,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }
    }

    logger.info(
      `Scraping complete: ${successful.length} successful, ${failed.length} failed`
    );

    return { successful, failed };
  }

  /**
   * Refresh prices for all active product sources
   */
  async refreshAllPrices(options?: {
    maxProducts?: number;
    humanized?: boolean;
  }): Promise<{
    refreshed: number;
    failed: number;
    triggeredAlerts: number;
  }> {
    logger.info("Starting price refresh for all active products");

    const maxProducts = options?.maxProducts || 100;

    // Get all products with sources
    const products = await productService.listProducts({
      limit: maxProducts,
    });

    let refreshed = 0;
    let failed = 0;
    let triggeredAlerts = 0;

    for (const product of products.items) {
      for (const source of product.sources) {
        if (!source.isActive) continue;

        try {
          const result = await this.scrapeAndSaveProduct(source.url, {
            sessionId: `refresh-${Date.now()}-${source.id}`,
            humanized: options?.humanized,
          });

          refreshed++;
          // Note: Triggered alerts are logged but not tracked here

          // Add delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 2000));
        } catch (error) {
          logger.error(`Failed to refresh price for source ${source.id}:`, error);
          failed++;
        }
      }
    }

    logger.info(
      `Price refresh complete: ${refreshed} refreshed, ${failed} failed, ${triggeredAlerts} alerts triggered`
    );

    return { refreshed, failed, triggeredAlerts };
  }
}

// Export singleton instance
export const scrapingOrchestrator = new ScrapingOrchestrator();
