import { database as db } from "@/db";
import {
  products,
  mergedProducts,
  productMatchSuggestions,
  productVariants,
  type Product,
  type MergedProduct,
  type MergedProductInsert,
  type ProductMatchSuggestion,
  type ProductMatchSuggestionInsert,
} from "@/db/individual/individual-schema";
import { eq, and, or, ne, sql, inArray } from "drizzle-orm";
import { logger } from "@/utils/logger";
import { attributeExtractorService } from "@/services/matching/attribute-extractor.service";

/**
 * Product Matching Service
 * Identifies duplicate products across different platforms and creates match suggestions
 */
export class ProductMatchingService {

  /**
   * Find potential matches for a product
   */
  async findMatches(productId: number): Promise<MatchResult[]> {
    logger.info(`[ProductMatching] Finding matches for product ${productId}`);

    // Get the product
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      with: {
        // Include existing matches to avoid duplicates
      },
    });

    if (!product) {
      logger.error(`[ProductMatching] Product ${productId} not found`);
      return [];
    }

    const matches: MatchResult[] = [];

    // 1. EAN Match (100% confidence)
    if (product.ean) {
      const eanMatches = await this.findByEan(product.ean, productId);
      matches.push(...eanMatches);
    }

    // 2. ASIN Match (95% confidence)
    if (product.asin) {
      const asinMatches = await this.findByAsin(product.asin, productId);
      matches.push(...asinMatches);
    }

    // 3. Brand + Model Match (90% confidence)
    if (product.brand && product.model) {
      const brandModelMatches = await this.findByBrandModel(product.brand, product.model, productId);
      matches.push(...brandModelMatches);
    }

    // 4. Fuzzy Name + Attributes Match (50-89% confidence)
    const fuzzyMatches = await this.findByFuzzyName(product, productId);
    matches.push(...fuzzyMatches);

    // Remove duplicates and sort by confidence
    const uniqueMatches = this.deduplicateMatches(matches);

    logger.info(`[ProductMatching] Found ${uniqueMatches.length} potential matches for product ${productId}`);

    return uniqueMatches.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Process matches and create match records or suggestions
   */
  async processMatches(productId: number, matches: MatchResult[]): Promise<ProcessResult> {
    const result: ProcessResult = {
      autoMerged: 0,
      suggestionsCreated: 0,
      skipped: 0,
    };

    let sourceProduct = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!sourceProduct) {
      logger.error(`[ProductMatching] Unable to process matches. Product ${productId} not found.`);
      return result;
    }

    for (const match of matches) {
      const targetProduct = await db.query.products.findFirst({
        where: eq(products.id, match.productId),
      });

      if (!targetProduct) {
        logger.warn(`[ProductMatching] Target product ${match.productId} not found. Skipping.`);
        result.skipped++;
        continue;
      }

      // Skip if both products already belong to the same merged product
      if (
        sourceProduct.mergedProductId &&
        targetProduct.mergedProductId &&
        sourceProduct.mergedProductId === targetProduct.mergedProductId
      ) {
        result.skipped++;
        continue;
      }

      if (!targetProduct.mergedProductId) {
        logger.warn(
          `[ProductMatching] Target product ${match.productId} has no merged product. Skipping suggestion.`
        );
        result.skipped++;
        continue;
      }

      const existingSuggestion = await db.query.productMatchSuggestions.findFirst({
        where: and(
          eq(productMatchSuggestions.productId, productId),
          eq(productMatchSuggestions.mergedProductId, targetProduct.mergedProductId)
        ),
      });

      if (existingSuggestion) {
        result.skipped++;
        continue;
      }

      // Auto-merge if confidence >= 90%
      if (match.confidence >= 0.90) {
        await this.createAutoMerge(productId, match);
        result.autoMerged++;
        const refreshed = await db.query.products.findFirst({
          where: eq(products.id, productId),
        });
        if (refreshed) {
          sourceProduct = refreshed;
        }
        logger.info(`[ProductMatching] Auto-merged products ${productId} and ${match.productId} (confidence: ${match.confidence})`);
      }
      // Create suggestion for manual review if confidence >= 50%
      else if (match.confidence >= 0.50) {
        await this.createSuggestion(productId, targetProduct.mergedProductId, match);
        result.suggestionsCreated++;
        logger.info(
          `[ProductMatching] Created match suggestion for product ${productId} and merged product ${targetProduct.mergedProductId} (confidence: ${match.confidence})`
        );
      }
      // Skip matches with confidence < 50%
      else {
        result.skipped++;
      }
    }

    return result;
  }

  /**
   * Find matches by EAN (100% confidence)
   */
  private async findByEan(ean: string, excludeProductId: number): Promise<MatchResult[]> {
    const matches = await db.select().from(products).where(
      and(
        eq(products.ean, ean),
        ne(products.id, excludeProductId)
      )
    );

    return matches.map((match): MatchResult => ({
      productId: match.id,
      confidence: 1.00,
      matchReasons: ['ean_match'],
      comparisonData: {
        ean: { source: ean, target: match.ean },
      },
    }));
  }

  /**
   * Find matches by ASIN (95% confidence)
   */
  private async findByAsin(asin: string, excludeProductId: number): Promise<MatchResult[]> {
    const matches = await db.select().from(products).where(
      and(
        eq(products.asin, asin),
        ne(products.id, excludeProductId)
      )
    );

    return matches.map((match): MatchResult => ({
      productId: match.id,
      confidence: 0.95,
      matchReasons: ['asin_match'],
      comparisonData: {
        asin: { source: asin, target: match.asin },
      },
    }));
  }

  /**
   * Find matches by Brand + Model (90% confidence)
   */
  private async findByBrandModel(brand: string, model: string, excludeProductId: number): Promise<MatchResult[]> {
    const matches = await db.select().from(products).where(
      and(
        eq(products.brand, brand),
        eq(products.model, model),
        ne(products.id, excludeProductId)
      )
    );

    return matches.map((match): MatchResult => ({
      productId: match.id,
      confidence: 0.90,
      matchReasons: ['brand_model_match'],
      comparisonData: {
        brand: { source: brand, target: match.brand },
        model: { source: model, target: match.model },
      },
    }));
  }

  /**
   * Find matches by fuzzy name similarity (50-89% confidence)
   */
  private async findByFuzzyName(product: Product, excludeProductId: number): Promise<MatchResult[]> {
    // Get all other products (don't filter by brand for fuzzy matching)
    // We want to find cross-platform matches even if brand extraction differs
    const candidates = await db.select().from(products).where(
      ne(products.id, excludeProductId)
    );

    const matches: MatchResult[] = [];

    for (const candidate of candidates) {
      const similarity = this.calculateNameSimilarity(product.name, candidate.name);

      if (similarity >= 0.50) {
        let confidenceBoost = 0;
        const matchReasons: string[] = ['fuzzy_name_match'];

        // Boost confidence if brands match
        if (product.brand && candidate.brand) {
          if (product.brand === candidate.brand) {
            matchReasons.push('brand_match');
            confidenceBoost += 0.15; // +15% confidence
          }
        }

        // Boost confidence if brands are present in names (even if brand field is null)
        const brandInBothNames = this.checkBrandInNames(product.name, candidate.name);
        if (brandInBothNames) {
          matchReasons.push('brand_in_name');
          confidenceBoost += 0.10; // +10% confidence
        }

        // Final confidence with boost (max 1.00)
        const finalConfidence = Math.min(similarity + confidenceBoost, 1.00);

        matches.push({
          productId: candidate.id,
          confidence: finalConfidence,
          matchReasons,
          comparisonData: {
            name: { source: product.name, target: candidate.name, similarity },
            brand: { source: product.brand, target: candidate.brand },
          },
        });
      }
    }

    return matches;
  }

  /**
   * Check if same brand appears in both product names
   */
  private checkBrandInNames(name1: string, name2: string): boolean {
    const commonBrands = [
      'samsung', 'apple', 'lg', 'sony', 'philips', 'panasonic',
      'dell', 'hp', 'lenovo', 'asus', 'acer', 'msi',
      'bosch', 'siemens', 'miele', 'beko', 'whirlpool',
    ];

    const lower1 = name1.toLowerCase();
    const lower2 = name2.toLowerCase();

    for (const brand of commonBrands) {
      if (lower1.includes(brand) && lower2.includes(brand)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Calculate similarity between two product names (0.0 - 1.0)
   * Uses multiple methods: token-based, Levenshtein, and key identifiers
   */
  private calculateNameSimilarity(name1: string, name2: string): number {
    const normalized1 = this.normalizeProductName(name1);
    const normalized2 = this.normalizeProductName(name2);

    // 1. Token-based similarity (Jaccard Index)
    const tokens1 = new Set(normalized1.split(/\s+/).filter(t => t.length > 0));
    const tokens2 = new Set(normalized2.split(/\s+/).filter(t => t.length > 0));

    const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
    const union = new Set([...tokens1, ...tokens2]);

    const tokenSimilarity = intersection.size / union.size;

    // 2. Key identifier matching (model numbers, sizes, etc.)
    // Extract patterns like "GU50U8079F", "U8079F", "50 zoll", "4k", etc.
    const keyIdentifiers = this.extractKeyIdentifiers(normalized1, normalized2);
    const keyIdentifierScore = keyIdentifiers.matchCount / Math.max(keyIdentifiers.total, 1);

    // 3. Levenshtein similarity (for shorter names or exact matches)
    // Use first 100 chars to avoid performance issues
    const shortName1 = normalized1.substring(0, 100);
    const shortName2 = normalized2.substring(0, 100);
    const levenshteinSimilarity = 1 - (
      this.levenshteinDistance(shortName1, shortName2) /
      Math.max(shortName1.length, shortName2.length)
    );

    // Weighted combination:
    // - 40% token-based (good for general similarity)
    // - 40% key identifiers (crucial for product matching)
    // - 20% Levenshtein (helps with typos and exact matches)
    return (tokenSimilarity * 0.4) + (keyIdentifierScore * 0.4) + (levenshteinSimilarity * 0.2);
  }

  /**
   * Extract and match key identifiers from product names
   */
  private extractKeyIdentifiers(name1: string, name2: string): { matchCount: number; total: number } {
    const patterns = [
      // Model numbers: GU50U8079F, U8079F, etc.
      /[a-z]{1,3}\d{2,}[a-z]{1,5}\d{0,3}[a-z]?/gi,
      // Screen sizes: 50 zoll, 65 inch, etc.
      /\d{2,3}\s*(?:zoll|inch|cm)/gi,
      // Storage/Memory: 256gb, 512gb, 16gb ram, etc.
      /\d+\s*(?:gb|tb|mb)/gi,
      // Resolution: 4k, uhd, full hd, 1080p, etc.
      /(?:4k|8k|uhd|full\s*hd|hd|1080p|720p|2160p)/gi,
    ];

    const identifiers1 = new Set<string>();
    const identifiers2 = new Set<string>();

    for (const pattern of patterns) {
      const matches1 = name1.match(pattern) || [];
      const matches2 = name2.match(pattern) || [];

      matches1.forEach(m => identifiers1.add(m.toLowerCase()));
      matches2.forEach(m => identifiers2.add(m.toLowerCase()));
    }

    // Count matches
    let matchCount = 0;
    for (const id of identifiers1) {
      if (identifiers2.has(id)) {
        matchCount++;
      }
    }

    const total = Math.max(identifiers1.size, identifiers2.size);

    return { matchCount, total };
  }

  /**
   * Normalize product name for comparison
   */
  private normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove special characters
      .replace(/\s+/g, ' ')      // Normalize whitespace
      .trim();
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Remove duplicate matches (keep highest confidence)
   */
  private deduplicateMatches(matches: MatchResult[]): MatchResult[] {
    const seen = new Map<number, MatchResult>();

    for (const match of matches) {
      const existing = seen.get(match.productId);
      if (!existing || match.confidence > existing.confidence) {
        seen.set(match.productId, match);
      }
    }

    return Array.from(seen.values());
  }

  /**
   * Create an auto-merge record and perform the actual merge
   */
  private async createAutoMerge(canonicalProductId: number, match: MatchResult): Promise<void> {
    // Perform the actual merge
    await this.mergeProducts([canonicalProductId, match.productId], {
      confidence: match.confidence,
      matchReasons: match.matchReasons,
      autoMerged: true,
    });
  }

  /**
   * Merge multiple source products into one merged product
   * This is the core merge logic that creates/updates the merged product and links all sources
   */
  async mergeProducts(
    sourceProductIds: number[],
    options: {
      confidence: number;
      matchReasons: string[];
      autoMerged: boolean;
      reviewedBy?: number;
    }
  ): Promise<MergedProduct> {
    logger.info(`[ProductMerge] Merging ${sourceProductIds.length} products: ${sourceProductIds.join(', ')}`);

    const mergedProduct = await db.transaction(async (tx) => {
      // 1. Load all source products
      const sourceProducts = await tx.select().from(products).where(
        inArray(products.id, sourceProductIds)
      );

      if (sourceProducts.length === 0) {
        throw new Error('No products found to merge');
      }

      // 2. Check if any product is already merged
      let existingMergedProduct: MergedProduct | null = null;
      for (const product of sourceProducts) {
        if (product.mergedProductId) {
          existingMergedProduct =
            (await tx.query.mergedProducts.findFirst({
              where: eq(mergedProducts.id, product.mergedProductId),
            })) ?? null;
          if (existingMergedProduct) {
            logger.info(`[ProductMerge] Found existing merged product ${existingMergedProduct.id}`);
            break;
          }
        }
      }

      let mergedProduct: MergedProduct;

      if (existingMergedProduct) {
        // 3a. Update existing merged product with new data
        mergedProduct = await this.updateMergedProduct(tx, existingMergedProduct, sourceProducts);
      } else {
        // 3b. Create new merged product
        mergedProduct = await this.createMergedProduct(tx, sourceProducts);
      }

      // 4. Link all source products to the merged product
      for (const sourceProduct of sourceProducts) {
        if (sourceProduct.mergedProductId !== mergedProduct.id) {
          await tx.update(products)
            .set({ mergedProductId: mergedProduct.id, updatedAt: new Date() })
            .where(eq(products.id, sourceProduct.id));
        }
      }

      // Update merged product source count
      await tx.update(mergedProducts)
        .set({
          sourceCount: sql`(SELECT COUNT(*) FROM ${products} WHERE ${products.mergedProductId} = ${mergedProduct.id})`,
          updatedAt: new Date(),
        })
        .where(eq(mergedProducts.id, mergedProduct.id));

      logger.info(`[ProductMerge] Successfully merged products into merged product ${mergedProduct.id}`);

      return mergedProduct;
    });

    try {
      await this.refreshMergedProductAttributes(mergedProduct.id);
    } catch (error) {
      logger.error(
        `[ProductMerge] Failed to refresh attributes for merged product ${mergedProduct.id}:`,
        error
      );
    }

    for (const productId of sourceProductIds) {
      try {
        await this.refreshProductVariantAttributes(productId);
      } catch (error) {
        logger.error(
          `[ProductMerge] Failed to refresh variant attributes for product ${productId}:`,
          error
        );
      }
    }

    return mergedProduct;
  }

  /**
   * Recompute attributes for a merged product based on its aggregated data.
   */
  private async refreshMergedProductAttributes(mergedProductId: number): Promise<void> {
    const mergedProduct = await db.query.mergedProducts.findFirst({
      where: eq(mergedProducts.id, mergedProductId),
    });

    if (!mergedProduct) {
      logger.warn(`[ProductMerge] Merged product ${mergedProductId} not found for attribute refresh.`);
      return;
    }

    if (!mergedProduct.name) {
      logger.debug(
        `[ProductMerge] Merged product ${mergedProductId} has no name. Skipping attribute extraction.`
      );
      return;
    }

    await attributeExtractorService.extractForMergedProduct({
      mergedProductId,
      productName: mergedProduct.name,
      metadata: mergedProduct.metadata as Record<string, any> | undefined,
    });
  }

  private async refreshProductVariantAttributes(productId: number): Promise<void> {
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product?.mergedProductId) {
      return;
    }

    const mergedMetadata =
      (product.metadata ?? {}) as Record<string, any>;

    await attributeExtractorService.extractForMergedProduct({
      mergedProductId: product.mergedProductId,
      productName: product.name,
      metadata: mergedMetadata,
      productId,
    });
  }

  /**
   * Create a new merged product from source products
   * Aggregates the best data from all sources
   */
  private async createMergedProduct(tx: any, sourceProducts: Product[]): Promise<MergedProduct> {
    logger.info(`[ProductMerge] Creating new merged product from ${sourceProducts.length} sources`);

    // Select the best data from all sources
    const bestData = this.aggregateProductData(sourceProducts);

    const mergedProductData: MergedProductInsert = {
      ean: bestData.ean,
      asin: bestData.asin,
      name: bestData.name,
      brand: bestData.brand,
      model: bestData.model,
      category: bestData.category,
      description: bestData.description,
      imageUrl: bestData.imageUrl,
      images: bestData.images,
      metadata: bestData.metadata,
      dataQualityScore: bestData.dataQualityScore.toString(),
      sourceCount: sourceProducts.length,
    };

    const [mergedProduct] = await tx.insert(mergedProducts).values(mergedProductData).returning();

    // Copy attributes to merged product
    await this.copyAttributesToMergedProduct(tx, sourceProducts, mergedProduct.id);

    return mergedProduct;
  }

  /**
   * Update an existing merged product with new source data
   */
  private async updateMergedProduct(
    tx: any,
    existingMergedProduct: MergedProduct,
    newSourceProducts: Product[]
  ): Promise<MergedProduct> {
    logger.info(`[ProductMerge] Updating merged product ${existingMergedProduct.id} with new sources`);

    // Get all existing source products
    const allSourceProducts = await tx.select().from(products).where(
      eq(products.mergedProductId, existingMergedProduct.id)
    );

    // Combine with new sources
    const combinedSources = [...allSourceProducts, ...newSourceProducts];

    // Re-aggregate best data
    const bestData = this.aggregateProductData(combinedSources);

    const [updatedMergedProduct] = await tx.update(mergedProducts)
      .set({
        ean: bestData.ean,
        asin: bestData.asin,
        name: bestData.name,
        brand: bestData.brand,
        model: bestData.model,
        category: bestData.category,
        description: bestData.description,
        imageUrl: bestData.imageUrl,
        images: bestData.images,
        metadata: bestData.metadata,
        dataQualityScore: bestData.dataQualityScore.toString(),
        updatedAt: new Date(),
      })
      .where(eq(mergedProducts.id, existingMergedProduct.id))
      .returning();

    // Copy attributes from new sources
    await this.copyAttributesToMergedProduct(tx, newSourceProducts, existingMergedProduct.id);

    return updatedMergedProduct;
  }

  /**
   * Aggregate product data from multiple sources
   * Selects the best/most complete data
   */
  private aggregateProductData(sourceProducts: Product[]): {
    ean: string | null;
    asin: string | null;
    name: string;
    brand: string | null;
    model: string | null;
    category: string | null;
    description: string | null;
    imageUrl: string | null;
    images: string[];
    metadata: Record<string, any>;
    dataQualityScore: number;
  } {
    // Prefer EAN/ASIN from most reliable source (first non-null)
    const ean = sourceProducts.find(p => p.ean)?.ean || null;
    const asin = sourceProducts.find(p => p.asin)?.asin || null;

    // Choose longest/most complete name
    const name = sourceProducts.reduce((best, current) =>
      current.name.length > best.length ? current.name : best
    , sourceProducts[0].name);

    // Prefer brand/model that appears most frequently
    const brand = this.mostFrequent(sourceProducts.map(p => p.brand).filter(Boolean)) || null;
    const model = this.mostFrequent(sourceProducts.map(p => p.model).filter(Boolean)) || null;

    // Choose category from most reliable source
    const category = sourceProducts.find(p => p.category)?.category || null;

    // Choose longest description
    const description = sourceProducts.reduce((best, current) => {
      const currentDesc = current.description || '';
      const bestDesc = best || '';
      return currentDesc.length > bestDesc.length ? currentDesc : bestDesc;
    }, sourceProducts[0].description);

    // Collect all unique image URLs
    const images = [...new Set(sourceProducts.map(p => p.imageUrl).filter(Boolean))] as string[];
    const imageUrl = images[0] || null;

    // Merge metadata from all sources
    const metadata = sourceProducts.reduce((merged, product) => {
      return { ...merged, ...(product.metadata as Record<string, any> || {}) };
    }, {});

    // Calculate data quality score (higher = better)
    let qualityScore = 0;
    if (ean) qualityScore += 0.3;
    if (asin) qualityScore += 0.2;
    if (brand) qualityScore += 0.1;
    if (model) qualityScore += 0.1;
    if (description && description.length > 100) qualityScore += 0.15;
    if (images.length > 0) qualityScore += 0.1;
    if (category) qualityScore += 0.05;
    qualityScore = Math.min(qualityScore, 1.0);

    return {
      ean,
      asin,
      name,
      brand,
      model,
      category,
      description,
      imageUrl,
      images,
      metadata,
      dataQualityScore: qualityScore,
    };
  }

  /**
   * Helper: Find most frequent value in array
   */
  private mostFrequent<T>(arr: T[]): T | null {
    if (arr.length === 0) return null;

    const frequency = new Map<T, number>();
    arr.forEach(item => {
      frequency.set(item, (frequency.get(item) || 0) + 1);
    });

    let maxFreq = 0;
    let mostFreq: T | null = null;
    frequency.forEach((freq, item) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        mostFreq = item;
      }
    });

    return mostFreq;
  }

  /**
   * Copy product attributes to merged product
   * Handles variant merging intelligently:
   * - If variant with same fingerprint exists, consolidate
   * - If variant is unique, move it
   * - Clean up orphaned variants and merged products
   */
  private async copyAttributesToMergedProduct(
    tx: any,
    sourceProducts: Product[],
    mergedProductId: number
  ): Promise<void> {
    const { productPrices } = await import("@/db/individual/individual-schema");

    for (const product of sourceProducts) {
      const variant =
        (await tx.query.productVariants.findFirst({
          where: eq(productVariants.primaryProductId, product.id),
        })) ?? null;

      if (!variant || variant.mergedProductId === mergedProductId) {
        continue;
      }

      // Check if a variant with the same fingerprint already exists in the target merged product
      const existingVariant =
        (await tx.query.productVariants.findFirst({
          where: and(
            eq(productVariants.mergedProductId, mergedProductId),
            eq(productVariants.fingerprint, variant.fingerprint)
          ),
        })) ?? null;

      if (existingVariant) {
        // Variant with same fingerprint exists - consolidate
        logger.info(
          `[ProductMerge] Found duplicate variant (fingerprint: ${variant.fingerprint}). Consolidating variant ${variant.id} into ${existingVariant.id}`
        );

        // 1. Update the old variant's primaryProductId to null (we'll delete it anyway)
        // And set the products to use the existing variant
        const productsUsingOldVariant = await tx.select().from(productVariants).where(
          eq(productVariants.id, variant.id)
        );

        // Update primaryProductId on the existing variant if it doesn't have one
        if (!existingVariant.primaryProductId && variant.primaryProductId) {
          await tx
            .update(productVariants)
            .set({ primaryProductId: variant.primaryProductId, updatedAt: new Date() })
            .where(eq(productVariants.id, existingVariant.id));
        }

        // 2. Move prices from old variant to existing variant (if not duplicates)
        const oldPrices = await tx.select().from(productPrices).where(
          eq(productPrices.variantId, variant.id)
        );

        for (const price of oldPrices) {
          // Check if price for this source already exists
          const existingPrice = await tx.query.productPrices.findFirst({
            where: and(
              eq(productPrices.variantId, existingVariant.id),
              eq(productPrices.productSourceId, price.productSourceId)
            ),
          });

          if (!existingPrice) {
            // Move price to existing variant
            await tx
              .update(productPrices)
              .set({ variantId: existingVariant.id, updatedAt: new Date() })
              .where(eq(productPrices.id, price.id));
          } else {
            // Price already exists, delete the old one
            await tx.delete(productPrices).where(eq(productPrices.id, price.id));
          }
        }

        // 3. Delete the orphaned variant
        await tx.delete(productVariants).where(eq(productVariants.id, variant.id));

        logger.info(
          `[ProductMerge] Deleted orphaned variant ${variant.id}, consolidated into ${existingVariant.id}`
        );
      } else {
        // No duplicate - just move the variant
        await tx
          .update(productVariants)
          .set({ mergedProductId, updatedAt: new Date() })
          .where(eq(productVariants.id, variant.id));

        logger.info(
          `[ProductMerge] Moved variant ${variant.id} to merged product ${mergedProductId}`
        );
      }
    }

    // Clean up orphaned merged products
    await this.cleanupOrphanedMergedProducts(tx);
  }

  /**
   * Delete merged products that have no associated products
   */
  private async cleanupOrphanedMergedProducts(tx: any): Promise<void> {
    const orphanedMergedProducts = await tx
      .select({ id: mergedProducts.id })
      .from(mergedProducts)
      .leftJoin(products, eq(products.mergedProductId, mergedProducts.id))
      .where(sql`${products.id} IS NULL`);

    for (const orphan of orphanedMergedProducts) {
      logger.info(`[ProductMerge] Deleting orphaned merged product ${orphan.id}`);

      // Delete orphaned variants
      await tx.delete(productVariants).where(
        eq(productVariants.mergedProductId, orphan.id)
      );

      // Delete the merged product
      await tx.delete(mergedProducts).where(eq(mergedProducts.id, orphan.id));
    }
  }

  /**
   * Create a match suggestion for manual review
   */
  private async createSuggestion(
    productId: number,
    mergedProductId: number,
    match: MatchResult
  ): Promise<void> {
    const suggestionData: ProductMatchSuggestionInsert = {
      productId,
      mergedProductId,
      confidence: match.confidence.toString(),
      matchReasons: match.matchReasons,
      comparisonData: match.comparisonData,
      status: 'pending',
    };

    await db.insert(productMatchSuggestions).values(suggestionData);
  }

  /**
   * Get all pending match suggestions
   */
  async getPendingSuggestions(): Promise<ProductMatchSuggestion[]> {
    return await db.select().from(productMatchSuggestions).where(
      eq(productMatchSuggestions.status, 'pending')
    );
  }

  /**
   * Accept a match suggestion and merge products
   */
  async acceptSuggestion(suggestionId: number, userId?: number): Promise<void> {
    const suggestion = await db.query.productMatchSuggestions.findFirst({
      where: eq(productMatchSuggestions.id, suggestionId),
    });

    if (!suggestion) {
      throw new Error(`Suggestion ${suggestionId} not found`);
    }

    const existingProducts = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.mergedProductId, suggestion.mergedProductId));

    if (existingProducts.length === 0) {
      throw new Error(
        `Merged product ${suggestion.mergedProductId} has no associated products to merge with`
      );
    }

    const sourceIds = Array.from(
      new Set([...existingProducts.map((p) => p.id), suggestion.productId])
    );

    // Perform the actual merge
    await this.mergeProducts(sourceIds, {
      confidence: parseFloat(suggestion.confidence),
      matchReasons: suggestion.matchReasons as string[],
      autoMerged: false,
      reviewedBy: userId,
    });

    // Update suggestion status
    await db.update(productMatchSuggestions)
      .set({
        status: 'accepted',
        reviewedBy: userId,
        reviewedAt: new Date(),
        actionTaken: 'merged',
      })
      .where(eq(productMatchSuggestions.id, suggestionId));

    logger.info(
      `[ProductMatching] Accepted suggestion ${suggestionId}, merged product ${suggestion.productId} into merged product ${suggestion.mergedProductId}`
    );
  }

  /**
   * Reject a match suggestion
   */
  async rejectSuggestion(suggestionId: number, userId?: number, notes?: string): Promise<void> {
    await db.update(productMatchSuggestions)
      .set({
        status: 'rejected',
        reviewedBy: userId,
        reviewedAt: new Date(),
        actionTaken: 'kept_separate',
        reviewNotes: notes,
      })
      .where(eq(productMatchSuggestions.id, suggestionId));

    logger.info(`[ProductMatching] Rejected suggestion ${suggestionId}`);
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface MatchResult {
  productId: number;
  confidence: number; // 0.0 - 1.0
  matchReasons: string[];
  comparisonData: Record<string, any>;
}

export interface ProcessResult {
  autoMerged: number;
  suggestionsCreated: number;
  skipped: number;
}

// Export singleton instance
export const productMatchingService = new ProductMatchingService();
