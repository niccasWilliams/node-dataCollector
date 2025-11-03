import { database } from "@/db";
import {
  products,
  productSources,
  productPrices,
  priceHistory,
  priceAlerts,
  websitePages,
  websites,
  productVariants,
  mergedProducts,
  type Product,
  type ProductInsert,
  type ProductSource,
  type ProductSourceInsert,
  type ProductPrice,
  type ProductPriceInsert,
  type PriceHistory,
  type PriceHistoryInsert,
  type PriceAlert,
  type PriceAlertInsert,
  type ProductAvailability,
  type ProductVariant,
  type MergedProduct,
} from "@/db/individual/individual-schema";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  ilike,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

// ============================================================================
// TYPES
// ============================================================================

export type ProductVariantSummary = ProductVariant | null;

export type ProductWithSources = Product & {
  variant: ProductVariantSummary;
  sources: (ProductSource & {
    currentPrice: ProductPrice | null;
    domain: string;
    url: string;
  })[];
};

export type ProductListParams = {
  search?: string;
  ean?: string;
  brand?: string;
  category?: string;
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "updatedAt" | "name";
  sortDirection?: "asc" | "desc";
};

export type ProductListResult = {
  items: ProductWithSources[];
  total: number;
  limit: number;
  offset: number;
};

export type PriceHistoryParams = {
  variantId?: number;
  productSourceId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
};

export type PriceHistoryResult = {
  items: PriceHistory[];
  total: number;
  limit: number;
  offset: number;
};

export type PriceHistoryUpdateInput = {
  price: PriceHistoryInsert["price"]; // Keep history price in sync even when unchanged
  currency?: PriceHistoryInsert["currency"] | null;
  originalPrice?: PriceHistoryInsert["originalPrice"];
  discountPercentage?: PriceHistoryInsert["discountPercentage"];
  availability?: ProductAvailability;
  stockQuantity?: number | null;
  metadata?: Record<string, unknown>;
};

export type PriceComparisonResult = {
  productId: number;
  productName: string;
  lowestPrice: {
    price: string;
    domain: string;
    url: string;
    availability: ProductAvailability;
  } | null;
  sources: {
    sourceId: number;
    domain: string;
    url: string;
    price: string | null;
    currency: string;
    availability: ProductAvailability;
    lastScraped: Date | null;
  }[];
};

// ============================================================================
// PRODUCT FUNCTIONS
// ============================================================================

/**
 * Create a new product
 */
export async function createProduct(data: ProductInsert): Promise<Product> {
  const now = new Date();
  const [created] = await database
    .insert(products)
    .values({
      ...data,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create product");
  }

  return created;
}

/**
 * Get product by ID with all sources and prices
 */
export async function getProductById(
  productId: number
): Promise<ProductWithSources | null> {
  const product = await database
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product[0]) {
    return null;
  }

  // Get all sources with their current prices
  const sourcesData = await database
    .select({
      source: productSources,
      currentPrice: productPrices,
      domain: websites.domain,
      url: websitePages.url,
    })
    .from(productSources)
    .leftJoin(productPrices, eq(productPrices.productSourceId, productSources.id))
    .innerJoin(websitePages, eq(websitePages.id, productSources.websitePageId))
    .innerJoin(websites, eq(websites.id, websitePages.websiteId))
    .where(eq(productSources.productId, productId));

  const sources = sourcesData.map((row) => ({
    ...row.source,
    currentPrice: row.currentPrice,
    domain: row.domain,
    url: row.url,
  }));

  const variantRow = await database
    .select()
    .from(productVariants)
    .where(eq(productVariants.primaryProductId, productId))
    .limit(1);

  const variant: ProductVariantSummary = variantRow[0] ?? null;

  return {
    ...product[0],
    variant,
    sources,
  };
}

export async function getMergedProductById(mergedProductId: number): Promise<MergedProduct | null> {
  const result = await database
    .select()
    .from(mergedProducts)
    .where(eq(mergedProducts.id, mergedProductId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get product by EAN
 */
export async function getProductByEan(ean: string): Promise<Product | null> {
  const result = await database
    .select()
    .from(products)
    .where(eq(products.ean, ean))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get product by ASIN
 */
export async function getProductByAsin(asin: string): Promise<Product | null> {
  const result = await database
    .select()
    .from(products)
    .where(eq(products.asin, asin))
    .limit(1);

  return result[0] ?? null;
}

/**
 * List products with filtering and pagination
 */
export async function listProducts(
  params: ProductListParams = {}
): Promise<ProductListResult> {
  const {
    search,
    ean,
    brand,
    category,
    limit = 20,
    offset = 0,
    orderBy = "updatedAt",
    sortDirection = "desc",
  } = params;

  const normalizedLimit = Math.min(Math.max(limit, 1), 200);
  const normalizedOffset = Math.max(offset, 0);

  const filters: SQL<unknown>[] = [];

  if (ean) {
    filters.push(eq(products.ean, ean));
  }

  if (brand) {
    filters.push(eq(products.brand, brand));
  }

  if (category) {
    filters.push(eq(products.category, category));
  }

  if (search) {
    const pattern = `%${search}%`;
    const maybeOr = or(
      ilike(products.name, pattern),
      ilike(products.brand, pattern),
      ilike(products.model, pattern),
      ilike(products.description, pattern)
    );
    if (maybeOr) {
      filters.push(maybeOr as SQL<unknown>);
    }
  }

  const orderColumn =
    orderBy === "createdAt"
      ? products.createdAt
      : orderBy === "name"
      ? products.name
      : products.updatedAt;
  const orderDirection =
    sortDirection === "asc" ? asc(orderColumn) : desc(orderColumn);

  // Get total count
  const totalQuery = database.select({ count: sql<number>`count(*)` }).from(products);
  if (filters.length > 0) {
    const computedWhere = and(...filters);
    if (computedWhere) {
      totalQuery.where(computedWhere as SQL<unknown>);
    }
  }
  const totalResult = await totalQuery;
  const total = Number(totalResult[0]?.count ?? 0);

  // Get products
  const productsQuery = database.select().from(products);
  if (filters.length > 0) {
    const computedWhere = and(...filters);
    if (computedWhere) {
      productsQuery.where(computedWhere as SQL<unknown>);
    }
  }

  const productList = await productsQuery
    .orderBy(orderDirection)
    .limit(normalizedLimit)
    .offset(normalizedOffset);

  // Fetch sources and prices for each product
  const productIds = productList.map((p) => p.id);
  const sourcesData = productIds.length
    ? await database
        .select({
          source: productSources,
          currentPrice: productPrices,
          domain: websites.domain,
          url: websitePages.url,
        })
        .from(productSources)
        .leftJoin(productPrices, eq(productPrices.productSourceId, productSources.id))
        .innerJoin(websitePages, eq(websitePages.id, productSources.websitePageId))
        .innerJoin(websites, eq(websites.id, websitePages.websiteId))
        .where(
          sql`${productSources.productId} IN (${sql.join(
            productIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
    : [];

  // Group sources by product ID
  const sourcesByProduct = new Map<number, typeof sourcesData>();
  for (const row of sourcesData) {
    const productId = row.source.productId;
    if (!sourcesByProduct.has(productId)) {
      sourcesByProduct.set(productId, []);
    }
    sourcesByProduct.get(productId)!.push(row);
  }

  const items: ProductWithSources[] = productList.map((product) => {
    const productSourcesData = sourcesByProduct.get(product.id) ?? [];
    const sources = productSourcesData.map((row) => ({
      ...row.source,
      currentPrice: row.currentPrice,
      domain: row.domain,
      url: row.url,
    }));

    return {
      ...product,
      variant: null,
      sources,
    };
  });

  return {
    items,
    total,
    limit: normalizedLimit,
    offset: normalizedOffset,
  };
}

/**
 * Update product
 */
export async function updateProduct(
  productId: number,
  data: Partial<ProductInsert>
): Promise<Product | null> {
  const [updated] = await database
    .update(products)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId))
    .returning();

  return updated ?? null;
}

/**
 * Delete product (cascades to sources, prices, history, alerts)
 */
export async function deleteProduct(productId: number): Promise<boolean> {
  const result = await database.delete(products).where(eq(products.id, productId)).returning();
  return result.length > 0;
}

// ============================================================================
// PRODUCT SOURCE FUNCTIONS
// ============================================================================

/**
 * Create a product source
 */
export async function createProductSource(
  data: ProductSourceInsert
): Promise<ProductSource> {
  const now = new Date();
  const [created] = await database
    .insert(productSources)
    .values({
      ...data,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create product source");
  }

  return created;
}

/**
 * Get product source by ID
 */
export async function getProductSourceById(
  sourceId: number
): Promise<ProductSource | null> {
  const result = await database
    .select()
    .from(productSources)
    .where(eq(productSources.id, sourceId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get product source by website page
 */
export async function getProductSourceByPageId(
  pageId: number
): Promise<ProductSource | null> {
  const result = await database
    .select()
    .from(productSources)
    .where(eq(productSources.websitePageId, pageId))
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get all sources for a product
 */
export async function getProductSources(productId: number): Promise<ProductSource[]> {
  return database
    .select()
    .from(productSources)
    .where(eq(productSources.productId, productId));
}

/**
 * Update product source
 */
export async function updateProductSource(
  sourceId: number,
  data: Partial<ProductSourceInsert>
): Promise<ProductSource | null> {
  const [updated] = await database
    .update(productSources)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(productSources.id, sourceId))
    .returning();

  return updated ?? null;
}

// ============================================================================
// PRODUCT PRICE FUNCTIONS
// ============================================================================

/**
 * Create or update current price for a variant+source combination
 * NEW: Prices are now stored per variant, not just per source
 */
export async function upsertProductPrice(
  data: ProductPriceInsert
): Promise<ProductPrice> {
  const now = new Date();

  // Check if price already exists for this variant+source combination
  const existing = await database
    .select()
    .from(productPrices)
    .where(
      and(
        eq(productPrices.variantId, data.variantId),
        eq(productPrices.productSourceId, data.productSourceId)
      )
    )
    .limit(1);

  if (existing[0]) {
    // Update existing price
    const [updated] = await database
      .update(productPrices)
      .set({
        ...data,
        scrapedAt: now,
        createdAt: existing[0].createdAt, // Preserve original creation time
      })
      .where(
        and(
          eq(productPrices.variantId, data.variantId),
          eq(productPrices.productSourceId, data.productSourceId)
        )
      )
      .returning();

    if (!updated) {
      throw new Error("Failed to update product price");
    }

    return updated;
  } else {
    // Create new price
    const [created] = await database
      .insert(productPrices)
      .values({
        ...data,
        scrapedAt: now,
        createdAt: now,
      })
      .returning();

    if (!created) {
      throw new Error("Failed to create product price");
    }

    return created;
  }
}

/**
 * Get current price for a variant+source combination
 */
export async function getCurrentPrice(
  variantId: number,
  productSourceId: number
): Promise<ProductPrice | null> {
  const result = await database
    .select()
    .from(productPrices)
    .where(
      and(
        eq(productPrices.variantId, variantId),
        eq(productPrices.productSourceId, productSourceId)
      )
    )
    .limit(1);

  return result[0] ?? null;
}

/**
 * Get all prices for a specific variant across all sources
 */
export async function getPricesForVariant(
  variantId: number
): Promise<ProductPrice[]> {
  return database
    .select()
    .from(productPrices)
    .where(eq(productPrices.variantId, variantId));
}

/**
 * Get price comparison for a product across all sources
 */
export async function getPriceComparison(
  productId: number
): Promise<PriceComparisonResult | null> {
  const product = await database
    .select()
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product[0]) {
    return null;
  }

  // Get all sources with prices
  const sourcesData = await database
    .select({
      sourceId: productSources.id,
      domain: websites.domain,
      url: websitePages.url,
      price: productPrices.price,
      currency: productPrices.currency,
      availability: productPrices.availability,
      lastScraped: productPrices.scrapedAt,
    })
    .from(productSources)
    .leftJoin(productPrices, eq(productPrices.productSourceId, productSources.id))
    .innerJoin(websitePages, eq(websitePages.id, productSources.websitePageId))
    .innerJoin(websites, eq(websites.id, websitePages.websiteId))
    .where(and(eq(productSources.productId, productId), eq(productSources.isActive, true)));

  // Find lowest price
  let lowestPrice: PriceComparisonResult["lowestPrice"] = null;
  for (const row of sourcesData) {
    if (
      row.price &&
      row.availability === "in_stock" &&
      (!lowestPrice || Number(row.price) < Number(lowestPrice.price))
    ) {
      lowestPrice = {
        price: row.price,
        domain: row.domain,
        url: row.url,
        availability: row.availability,
      };
    }
  }

  const sources = sourcesData.map((row) => ({
    sourceId: row.sourceId,
    domain: row.domain,
    url: row.url,
    price: row.price,
    currency: row.currency ?? "EUR",
    availability: row.availability ?? "unknown",
    lastScraped: row.lastScraped,
  }));

  return {
    productId: product[0].id,
    productName: product[0].name,
    lowestPrice,
    sources,
  };
}

// ============================================================================
// PRICE HISTORY FUNCTIONS
// ============================================================================

/**
 * Add price history record
 * Should be called whenever price changes
 * NEW: Records history per variant+source combination
 */
export async function addPriceHistory(
  data: PriceHistoryInsert
): Promise<PriceHistory> {
  const now = new Date();
  const [created] = await database
    .insert(priceHistory)
    .values({
      ...data,
      recordedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create price history record");
  }

  return created;
}

/**
 * Update the most recent price history entry for a variant+source combination.
 * Used when the price remains the same but other data (availability, stock, etc.) changes.
 */
export async function updateLatestPriceHistory(
  variantId: number,
  productSourceId: number,
  data: PriceHistoryUpdateInput
): Promise<PriceHistory | null> {
  const latest = await database
    .select()
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.variantId, variantId),
        eq(priceHistory.productSourceId, productSourceId)
      )
    )
    .orderBy(desc(priceHistory.recordedAt))
    .limit(1);

  const current = latest[0];
  if (!current) {
    return null;
  }

  const updatePayload: Partial<typeof priceHistory.$inferInsert> = {
    price: data.price,
    recordedAt: new Date(),
  };

  if (data.currency !== undefined) updatePayload.currency = data.currency ?? current.currency;
  if (data.originalPrice !== undefined) updatePayload.originalPrice = data.originalPrice;
  if (data.discountPercentage !== undefined) updatePayload.discountPercentage = data.discountPercentage;
  if (data.availability !== undefined) updatePayload.availability = data.availability;
  if (data.stockQuantity !== undefined) updatePayload.stockQuantity = data.stockQuantity;
  if (data.metadata !== undefined) updatePayload.metadata = data.metadata;

  const [updated] = await database
    .update(priceHistory)
    .set(updatePayload)
    .where(eq(priceHistory.id, current.id))
    .returning();

  return updated ?? current;
}

/**
 * Get price history for a variant+source combination
 */
export async function getPriceHistory(
  params: PriceHistoryParams
): Promise<PriceHistoryResult> {
  const {
    variantId,
    productSourceId,
    startDate,
    endDate,
    limit = 100,
    offset = 0,
  } = params;

  const normalizedLimit = Math.min(Math.max(limit, 1), 1000);
  const normalizedOffset = Math.max(offset, 0);

  const filters: SQL<unknown>[] = [];

  if (variantId !== undefined) {
    filters.push(eq(priceHistory.variantId, variantId));
  }

  if (productSourceId !== undefined) {
    filters.push(eq(priceHistory.productSourceId, productSourceId));
  }

  if (startDate) {
    filters.push(gte(priceHistory.recordedAt, startDate));
  }

  if (endDate) {
    filters.push(lte(priceHistory.recordedAt, endDate));
  }

  const whereClause = and(...filters);
  if (!whereClause) {
    throw new Error("Failed to build price history filter");
  }

  // Get total count
  const totalResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(priceHistory)
    .where(whereClause);

  const total = Number(totalResult[0]?.count ?? 0);

  // Get history records
  const items = await database
    .select()
    .from(priceHistory)
    .where(whereClause)
    .orderBy(desc(priceHistory.recordedAt))
    .limit(normalizedLimit)
    .offset(normalizedOffset);

  return {
    items,
    total,
    limit: normalizedLimit,
    offset: normalizedOffset,
  };
}

/**
 * Get price statistics for a variant+source combination
 */
export async function getPriceStatistics(
  variantId: number,
  productSourceId: number,
  days: number = 30
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const stats = await database
    .select({
      minPrice: sql<string>`MIN(${priceHistory.price})`,
      maxPrice: sql<string>`MAX(${priceHistory.price})`,
      avgPrice: sql<string>`AVG(${priceHistory.price})`,
      recordCount: sql<number>`COUNT(*)`,
      priceChanges: sql<number>`COUNT(CASE WHEN ${priceHistory.priceChanged} = true THEN 1 END)`,
    })
    .from(priceHistory)
    .where(
      and(
        eq(priceHistory.variantId, variantId),
        eq(priceHistory.productSourceId, productSourceId),
        gte(priceHistory.recordedAt, startDate)
      )
    );

  return stats[0] ?? null;
}

// ============================================================================
// PRICE ALERT FUNCTIONS
// ============================================================================

/**
 * Create price alert
 */
export async function createPriceAlert(data: PriceAlertInsert): Promise<PriceAlert> {
  const now = new Date();
  const [created] = await database
    .insert(priceAlerts)
    .values({
      ...data,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error("Failed to create price alert");
  }

  return created;
}

/**
 * Get active alerts for a merged product
 */
export async function getActiveAlerts(mergedProductId: number): Promise<PriceAlert[]> {
  return database
    .select()
    .from(priceAlerts)
    .where(and(eq(priceAlerts.mergedProductId, mergedProductId), eq(priceAlerts.status, "active")));
}

/**
 * Get active alerts for a specific variant
 */
export async function getActiveAlertsForVariant(variantId: number): Promise<PriceAlert[]> {
  return database
    .select()
    .from(priceAlerts)
    .where(and(eq(priceAlerts.variantId, variantId), eq(priceAlerts.status, "active")));
}

/**
 * Trigger alert
 */
export async function triggerAlert(
  alertId: number,
  triggeredPrice: string
): Promise<PriceAlert | null> {
  const [updated] = await database
    .update(priceAlerts)
    .set({
      status: "triggered",
      triggeredAt: new Date(),
      triggeredPrice,
      updatedAt: new Date(),
    })
    .where(eq(priceAlerts.id, alertId))
    .returning();

  return updated ?? null;
}
