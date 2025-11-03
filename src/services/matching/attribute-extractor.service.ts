import { database as db } from "@/db";
import {
  productAttributes,
  products,
  productVariants,
  mergedProducts,
  type Product,
  type ProductVariant,
  type MergedProduct,
  type ProductAttribute,
  type ProductAttributeInsert,
  type ProductAttributeType,
} from "@/db/individual/individual-schema";
import { eq, and } from "drizzle-orm";
import { logger } from "@/utils/logger";

/**
 * Attribute Extractor Service
 * Extracts structured attributes from product names and descriptions
 */
export class AttributeExtractorService {
  private readonly variantAttributeKeys = new Set<string>([
    "screen_size",
    "storage_capacity",
    "ram",
    "display_resolution",
    "color",
    "cpu",
    "weight",
  ]);

  /**
   * Extract attributes from product data
   */
  async extractAndSaveAttributes(productId: number, productName: string, metadata?: Record<string, any>): Promise<ExtractedAttribute[]> {
    logger.info(`[AttributeExtractor] Extracting attributes for product ${productId}: "${productName}"`);

    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product) {
      logger.warn(`[AttributeExtractor] Product ${productId} not found. Skipping attribute extraction.`);
      return [];
    }

    const mergedProductId = await this.ensureMergedProductForProduct(product);

    return this.extractForMergedProduct({
      mergedProductId,
      productId,
      productName,
      metadata,
    });
  }

  /**
   * Extract attributes from text
   */
  private extractAttributes(text: string, metadata?: Record<string, any>): ExtractedAttribute[] {
    const attributes: ExtractedAttribute[] = [];

    // Screen Size (TV, Monitor)
    const screenSizeMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(?:zoll|inch|"|'')/i);
    if (screenSizeMatch) {
      const value = parseFloat(screenSizeMatch[1].replace(',', '.'));
      const unit = text.toLowerCase().includes('zoll') ? 'Zoll' : 'inch';

      attributes.push({
        type: 'screen_size',
        key: 'screen_size',
        value: value.toString(),
        unit,
        displayValue: `${value} ${unit}`,
        normalizedValue: unit === 'Zoll' ? value * 2.54 : value * 2.54, // Convert to cm
        normalizedUnit: 'cm',
        confidence: 0.95,
      });
    }

    // Storage (Phone, Laptop, etc.)
    const storageMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(gb|tb|mb)/i);
    if (storageMatch) {
      const value = parseFloat(storageMatch[1].replace(',', '.'));
      const unit = storageMatch[2].toUpperCase();

      attributes.push({
        type: 'storage',
        key: 'storage_capacity',
        value: value.toString(),
        unit,
        displayValue: `${value}${unit}`,
        normalizedValue: unit === 'TB' ? value * 1024 : value, // Convert to GB
        normalizedUnit: 'GB',
        confidence: 0.90,
      });
    }

    // Memory/RAM
    const memoryMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(gb|mb)\s*(?:ram|memory|speicher)/i);
    if (memoryMatch) {
      const value = parseFloat(memoryMatch[1].replace(',', '.'));
      const unit = memoryMatch[2].toUpperCase();

      attributes.push({
        type: 'memory',
        key: 'ram',
        value: value.toString(),
        unit,
        displayValue: `${value}${unit} RAM`,
        normalizedValue: unit === 'MB' ? value / 1024 : value, // Convert to GB
        normalizedUnit: 'GB',
        confidence: 0.90,
      });
    }

    // Resolution
    const resolutionPatterns = [
      { pattern: /4k|uhd|ultra\s*hd|3840\s*x\s*2160/i, value: '4K', normalized: 3840 },
      { pattern: /full\s*hd|1080p|1920\s*x\s*1080/i, value: 'Full HD', normalized: 1920 },
      { pattern: /hd|720p|1280\s*x\s*720/i, value: 'HD', normalized: 1280 },
      { pattern: /8k|7680\s*x\s*4320/i, value: '8K', normalized: 7680 },
    ];

    for (const res of resolutionPatterns) {
      if (res.pattern.test(text)) {
        attributes.push({
          type: 'resolution',
          key: 'display_resolution',
          value: res.value,
          unit: null,
          displayValue: res.value,
          normalizedValue: res.normalized,
          normalizedUnit: 'px',
          confidence: 0.95,
        });
        break;
      }
    }

    // Color
    const colorPatterns = [
      'schwarz', 'black', 'weiß', 'white', 'silber', 'silver', 'grau', 'gray', 'grey',
      'rot', 'red', 'blau', 'blue', 'grün', 'green', 'gold', 'space gray', 'midnight',
    ];

    for (const color of colorPatterns) {
      if (new RegExp(`\\b${color}\\b`, 'i').test(text)) {
        attributes.push({
          type: 'color',
          key: 'color',
          value: color,
          unit: null,
          displayValue: color.charAt(0).toUpperCase() + color.slice(1),
          normalizedValue: null,
          normalizedUnit: null,
          confidence: 0.70,
        });
        break;
      }
    }

    // Processor (simplified)
    const processorMatch = text.match(/(intel|amd|apple)\s*(i\d|ryzen|m\d|a\d+)/i);
    if (processorMatch) {
      const value = processorMatch[0];
      attributes.push({
        type: 'processor',
        key: 'cpu',
        value,
        unit: null,
        displayValue: value,
        normalizedValue: null,
        normalizedUnit: null,
        confidence: 0.75,
      });
    }

    // Weight
    const weightMatch = text.match(/(\d+(?:[.,]\d+)?)\s*(kg|g|gramm|kilogramm)/i);
    if (weightMatch) {
      const value = parseFloat(weightMatch[1].replace(',', '.'));
      const unit = weightMatch[2].toLowerCase();

      const isKg = unit.includes('kg') || unit.includes('kilogramm');

      attributes.push({
        type: 'weight',
        key: 'weight',
        value: value.toString(),
        unit: isKg ? 'kg' : 'g',
        displayValue: `${value}${isKg ? 'kg' : 'g'}`,
        normalizedValue: isKg ? value : value / 1000, // Convert to kg
        normalizedUnit: 'kg',
        confidence: 0.80,
      });
    }

    return attributes;
  }

  private buildVariantDescriptor(attributes: ExtractedAttribute[]): VariantDescriptor {
    const variantRelevant = attributes.filter((attr) => this.variantAttributeKeys.has(attr.key));

    if (variantRelevant.length === 0) {
      return {
        fingerprint: "default",
        label: "Standard",
        attributes: {},
        isDefault: true,
      };
    }

    const sorted = [...variantRelevant].sort((a, b) => a.key.localeCompare(b.key));

    const fingerprintParts = sorted.map((attr) => {
      const baseValue =
        attr.normalizedValue !== null && attr.normalizedValue !== undefined
          ? Number(attr.normalizedValue).toFixed(4)
          : attr.value.trim().toLowerCase();
      const unit =
        attr.normalizedUnit?.toLowerCase() ??
        attr.unit?.toLowerCase() ??
        "";
      return `${attr.key.toLowerCase()}:${baseValue}${unit ? `:${unit}` : ""}`;
    });

    const labelParts = sorted.map((attr) => {
      const display = attr.displayValue || attr.value;
      const unit = attr.unit && !display.toLowerCase().includes(attr.unit.toLowerCase())
        ? ` ${attr.unit}`
        : "";
      return `${display}${unit}`;
    });

    const attributesSnapshot: Record<string, VariantAttributeSnapshot> = {};
    for (const attr of sorted) {
      attributesSnapshot[attr.key] = {
        value: attr.value,
        unit: attr.unit,
        displayValue: attr.displayValue,
        normalizedValue: attr.normalizedValue,
        normalizedUnit: attr.normalizedUnit,
      };
    }

    return {
      fingerprint: fingerprintParts.join("|"),
      label: labelParts.join(" / "),
      attributes: attributesSnapshot,
      isDefault: false,
    };
  }

  private async ensureMergedProductForProduct(product: Product): Promise<number> {
    if (product.mergedProductId) {
      const existing = await db.query.mergedProducts.findFirst({
        where: eq(mergedProducts.id, product.mergedProductId),
      });
      if (existing) {
        return existing.id;
      }
    }

    const mergedProduct = await this.createMergedProductFromProduct(product);

    await db
      .update(products)
      .set({ mergedProductId: mergedProduct.id, updatedAt: new Date() })
      .where(eq(products.id, product.id));

    return mergedProduct.id;
  }

  private async createMergedProductFromProduct(product: Product): Promise<MergedProduct> {
    const aggregated = this.aggregateProductBasics([product]);

    const [created] = await db
      .insert(mergedProducts)
      .values({
        ean: aggregated.ean,
        asin: aggregated.asin,
        name: aggregated.name,
        brand: aggregated.brand,
        model: aggregated.model,
        category: aggregated.category,
        description: aggregated.description,
        imageUrl: aggregated.imageUrl,
        images: aggregated.images,
        metadata: aggregated.metadata,
        dataQualityScore: aggregated.dataQualityScore.toFixed(2),
        sourceCount: aggregated.sourceCount,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create merged product");
    }

    logger.debug(`[AttributeExtractor] Created merged product ${created.id} for product ${product.id}`);

    return created;
  }

  private async updateMergedProductFromVariants(mergedProductId: number): Promise<void> {
    const relatedProducts = await db
      .select()
      .from(products)
      .where(eq(products.mergedProductId, mergedProductId));

    if (relatedProducts.length === 0) {
      logger.debug(
        `[AttributeExtractor] No source products found for merged product ${mergedProductId}; skipping update.`
      );
      return;
    }

    const aggregated = this.aggregateProductBasics(relatedProducts);

    await db
      .update(mergedProducts)
      .set({
        ean: aggregated.ean,
        asin: aggregated.asin,
        name: aggregated.name,
        brand: aggregated.brand,
        model: aggregated.model,
        category: aggregated.category,
        description: aggregated.description,
        imageUrl: aggregated.imageUrl,
        images: aggregated.images,
        metadata: aggregated.metadata,
        dataQualityScore: aggregated.dataQualityScore.toFixed(2),
        sourceCount: aggregated.sourceCount,
        updatedAt: new Date(),
      })
      .where(eq(mergedProducts.id, mergedProductId));

    logger.debug(
      `[AttributeExtractor] Updated merged product ${mergedProductId} basics from ${relatedProducts.length} source products`
    );
  }

  private aggregateProductBasics(sourceProducts: Product[]): AggregatedProductBasics {
    if (sourceProducts.length === 0) {
      return {
        ean: null,
        asin: null,
        name: "",
        brand: null,
        model: null,
        category: null,
        description: null,
        imageUrl: null,
        images: [],
        metadata: {},
        dataQualityScore: 0,
        sourceCount: 0,
      };
    }

    const ean = sourceProducts.find((p) => p.ean)?.ean ?? null;
    const asin = sourceProducts.find((p) => p.asin)?.asin ?? null;

    let name = sourceProducts[0].name;
    for (const product of sourceProducts) {
      if (product.name.length > name.length) {
        name = product.name;
      }
    }

    const brand = this.mostFrequent(
      sourceProducts
        .map((p) => p.brand)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    );

    const model = this.mostFrequent(
      sourceProducts
        .map((p) => p.model)
        .filter((value): value is string => typeof value === "string" && value.length > 0)
    );

    const category = sourceProducts.find((p) => p.category)?.category ?? null;

    let description = sourceProducts[0].description ?? null;
    for (const product of sourceProducts) {
      const current = product.description ?? null;
      if (current && (!description || current.length > description.length)) {
        description = current;
      }
    }

    const images = Array.from(
      new Set(
        sourceProducts
          .map((p) => p.imageUrl)
          .filter((value): value is string => typeof value === "string" && value.length > 0)
      )
    );
    const imageUrl = images[0] ?? null;

    const metadata: Record<string, unknown> = {};
    for (const product of sourceProducts) {
      const data = product.metadata as Record<string, unknown> | null;
      if (data && typeof data === "object") {
        Object.assign(metadata, data);
      }
    }

    let dataQualityScore = 0;
    if (ean) dataQualityScore += 0.3;
    if (asin) dataQualityScore += 0.2;
    if (brand) dataQualityScore += 0.1;
    if (model) dataQualityScore += 0.1;
    if (description && description.length > 100) dataQualityScore += 0.15;
    if (images.length > 0) dataQualityScore += 0.1;
    if (category) dataQualityScore += 0.05;
    dataQualityScore = Math.min(dataQualityScore, 1);

    return {
      ean,
      asin,
      name,
      brand: brand ?? null,
      model: model ?? null,
      category,
      description,
      imageUrl,
      images,
      metadata,
      dataQualityScore,
      sourceCount: sourceProducts.length,
    };
  }

  private mostFrequent<T>(values: T[]): T | null {
    if (values.length === 0) {
      return null;
    }

    const counts = new Map<T, number>();
    for (const value of values) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    let mostValue: T | null = null;
    let maxCount = 0;
    for (const [value, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostValue = value;
      }
    }

    return mostValue;
  }

  private async ensureVariant(
    mergedProductId: number,
    productId: number | null,
    attributes: ExtractedAttribute[]
  ): Promise<ProductVariant | null> {
    if (!productId) {
      return null;
    }

    const descriptor = this.buildVariantDescriptor(attributes);

    let variant: ProductVariant | null = null;

    variant =
      (await db.query.productVariants.findFirst({
        where: eq(productVariants.primaryProductId, productId),
      })) ?? null;

    if (!variant) {
      variant =
        (await db.query.productVariants.findFirst({
          where: and(
            eq(productVariants.mergedProductId, mergedProductId),
            eq(productVariants.fingerprint, descriptor.fingerprint)
          ),
        })) ?? null;
    }

    if (!variant) {
      const [created] = await db
        .insert(productVariants)
        .values({
          mergedProductId,
          primaryProductId: productId ?? null,
          fingerprint: descriptor.fingerprint,
          label: descriptor.label,
          attributes: descriptor.attributes,
          isDefault: descriptor.isDefault,
        })
        .returning();

      variant = created ?? null;

      if (variant) {
        logger.debug(
          `[AttributeExtractor] Created variant ${variant.id} for merged product ${mergedProductId} ` +
            `(fingerprint: ${descriptor.fingerprint})`
        );
      }
    } else {
      const updates: Partial<Pick<ProductVariant, "label" | "attributes" | "isDefault" | "primaryProductId">> & {
        updatedAt?: Date;
      } = {};

      if (descriptor.label && descriptor.label !== variant.label) {
        updates.label = descriptor.label;
      }

      if (JSON.stringify(variant.attributes) !== JSON.stringify(descriptor.attributes)) {
        updates.attributes = descriptor.attributes;
      }

      if (descriptor.isDefault && !variant.isDefault) {
        updates.isDefault = true;
      }

      if (variant.primaryProductId == null) {
        updates.primaryProductId = productId;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date();
        const [updated] = await db
          .update(productVariants)
          .set(updates)
          .where(eq(productVariants.id, variant.id))
          .returning();

        variant = updated ?? variant;
      }
    }

    return variant;
  }

  /**
   * Save attribute to database (with upsert logic)
   */
  async extractForMergedProduct(params: {
    mergedProductId: number;
    productName: string;
    metadata?: Record<string, any>;
    productId?: number | null;
  }): Promise<ExtractedAttribute[]> {
    const { mergedProductId, productName, metadata, productId } = params;
    const attributes = this.extractAttributes(productName, metadata);

    const variant = productId
      ? await this.ensureVariant(mergedProductId, productId ?? null, attributes)
      : null;

    if (variant) {
      for (const attr of attributes) {
        await this.saveAttribute(variant.id, mergedProductId, attr);
      }
    } else {
      logger.debug(
        `[AttributeExtractor] Skipping attribute persistence for merged product ${mergedProductId} (no variant context)`
      );
    }

    await this.updateMergedProductFromVariants(mergedProductId);

    logger.info(
      `[AttributeExtractor] Extracted ${attributes.length} attributes for merged product ${mergedProductId}` +
        (variant ? ` (variant ${variant.id})` : " (no variant persisted)")
    );

    return attributes;
  }

  /**
   * Persist a single attribute for a merged product / variant
   */
  private async saveAttribute(
    variantId: number,
    mergedProductId: number,
    attr: ExtractedAttribute
  ): Promise<void> {
    const existing =
      (await db.query.productAttributes.findFirst({
        where: and(
          eq(productAttributes.variantId, variantId),
          eq(productAttributes.type, attr.type),
          eq(productAttributes.key, attr.key)
        ),
      })) ?? null;

    const attributeData: ProductAttributeInsert = {
      variantId,
      type: attr.type,
      key: attr.key,
      value: attr.value,
      unit: attr.unit,
      displayValue: attr.displayValue,
      normalizedValue: attr.normalizedValue?.toString() || null,
      normalizedUnit: attr.normalizedUnit,
      source: "extracted",
      confidence: attr.confidence.toString(),
    };

    if (existing) {
      if (parseFloat(existing.confidence) < attr.confidence) {
        await db
          .update(productAttributes)
          .set({ ...attributeData, updatedAt: new Date() })
          .where(eq(productAttributes.id, existing.id));

        logger.debug(
          `[AttributeExtractor] Updated attribute ${attr.key} for merged product ${mergedProductId} (variant ${variantId})`
        );
      }
    } else {
      await db.insert(productAttributes).values(attributeData);
      logger.debug(
        `[AttributeExtractor] Saved attribute ${attr.key} for merged product ${mergedProductId} (variant ${variantId}): ${attr.displayValue}`
      );
    }
  }

  /**
   * Get all attributes for a product
   */
  async getProductAttributes(productId: number): Promise<ProductAttribute[]> {
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product?.mergedProductId) {
      logger.debug(`[AttributeExtractor] Product ${productId} has no merged product. Returning empty attribute list.`);
      return [];
    }

    const variant =
      (await db.query.productVariants.findFirst({
        where: eq(productVariants.primaryProductId, productId),
      })) ??
      (await db.query.productVariants.findFirst({
        where: and(
          eq(productVariants.mergedProductId, product.mergedProductId),
          eq(productVariants.isDefault, true)
        ),
      })) ??
      null;

    if (!variant) {
      logger.debug(
        `[AttributeExtractor] No variant found for product ${productId}. Returning empty attribute list.`
      );
      return [];
    }

    return await db
      .select()
      .from(productAttributes)
      .where(eq(productAttributes.variantId, variant.id));
  }

  /**
   * Delete all attributes for a product
   */
  async deleteProductAttributes(productId: number): Promise<void> {
    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
    });

    if (!product?.mergedProductId) {
      logger.debug(`[AttributeExtractor] Product ${productId} has no merged product. Nothing to delete.`);
      return;
    }

    const variant =
      (await db.query.productVariants.findFirst({
        where: eq(productVariants.primaryProductId, productId),
      })) ?? null;

    if (!variant) {
      logger.debug(
        `[AttributeExtractor] No variant linked to product ${productId}. Nothing to delete.`
      );
      return;
    }

    await db
      .delete(productAttributes)
      .where(eq(productAttributes.variantId, variant.id));

    await db.delete(productVariants).where(eq(productVariants.id, variant.id));
    logger.debug(
      `[AttributeExtractor] Removed variant ${variant.id} and attributes for product ${productId}`
    );

    logger.info(
      `[AttributeExtractor] Deleted attributes for merged product ${product.mergedProductId} variant ${variant.id} (source product ${productId})`
    );
  }
}

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractedAttribute {
  type: ProductAttributeType;
  key: string;
  value: string;
  unit: string | null;
  displayValue: string;
  normalizedValue: number | null;
  normalizedUnit: string | null;
  confidence: number;
}

interface VariantAttributeSnapshot {
  value: string;
  unit: string | null;
  displayValue: string;
  normalizedValue: number | null;
  normalizedUnit: string | null;
}

interface VariantDescriptor {
  fingerprint: string;
  label: string;
  attributes: Record<string, VariantAttributeSnapshot>;
  isDefault: boolean;
}

interface AggregatedProductBasics {
  ean: string | null;
  asin: string | null;
  name: string;
  brand: string | null;
  model: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  images: string[];
  metadata: Record<string, unknown>;
  dataQualityScore: number;
  sourceCount: number;
}

// Export singleton instance
export const attributeExtractorService = new AttributeExtractorService();
