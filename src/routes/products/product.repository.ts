import { database } from "@/db";
import {
  products,
  productSources,
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
    currentPrice: PriceHistory | null; // Changed from ProductPrice to PriceHistory (latest entry)
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
 * NEW: Prices are fetched from priceHistory (latest entry per source)
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

  // Get all sources
  const sourcesData = await database
    .select({
      source: productSources,
      domain: websites.domain,
      url: websitePages.url,
    })
    .from(productSources)
    .innerJoin(websitePages, eq(websitePages.id, productSources.websitePageId))
    .innerJoin(websites, eq(websites.id, websitePages.websiteId))
    .where(eq(productSources.productId, productId));

  // Get variant for this product
  const variantRow = await database
    .select()
    .from(productVariants)
    .where(eq(productVariants.primaryProductId, productId))
    .limit(1);

  const variant: ProductVariantSummary = variantRow[0] ?? null;

  // For each source, get the latest price from priceHistory
  const sources = await Promise.all(
    sourcesData.map(async (row) => {
      let currentPrice: PriceHistory | null = null;

      if (variant) {
        // Get latest price history entry for this variant+source combination
        const latestPrice = await database
          .select()
          .from(priceHistory)
          .where(
            and(
              eq(priceHistory.variantId, variant.id),
              eq(priceHistory.productSourceId, row.source.id)
            )
          )
          .orderBy(desc(priceHistory.recordedAt))
          .limit(1);

        currentPrice = latestPrice[0] ?? null;
      }

      return {
        ...row.source,
        currentPrice,
        domain: row.domain,
        url: row.url,
      };
    })
  );

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

  // Fetch sources for each product (without prices for now - they come from priceHistory)
  const productIds = productList.map((p) => p.id);
  const sourcesData = productIds.length
    ? await database
        .select({
          source: productSources,
          domain: websites.domain,
          url: websitePages.url,
        })
        .from(productSources)
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

  // Get variants for all products (for price lookups)
  const variantsByProductId = new Map<number, ProductVariant>();
  if (productIds.length > 0) {
    const variants = await database
      .select()
      .from(productVariants)
      .where(
        sql`${productVariants.primaryProductId} IN (${sql.join(
          productIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      );

    for (const variant of variants) {
      if (variant.primaryProductId) {
        variantsByProductId.set(variant.primaryProductId, variant);
      }
    }
  }

  // Build items with sources and latest prices
  const items: ProductWithSources[] = await Promise.all(
    productList.map(async (product) => {
      const productSourcesData = sourcesByProduct.get(product.id) ?? [];
      const variant = variantsByProductId.get(product.id) ?? null;

      const sources = await Promise.all(
        productSourcesData.map(async (row) => {
          let currentPrice: PriceHistory | null = null;

          if (variant) {
            // Get latest price from priceHistory
            const latestPrice = await database
              .select()
              .from(priceHistory)
              .where(
                and(
                  eq(priceHistory.variantId, variant.id),
                  eq(priceHistory.productSourceId, row.source.id)
                )
              )
              .orderBy(desc(priceHistory.recordedAt))
              .limit(1);

            currentPrice = latestPrice[0] ?? null;
          }

          return {
            ...row.source,
            currentPrice,
            domain: row.domain,
            url: row.url,
          };
        })
      );

      return {
        ...product,
        variant,
        sources,
      };
    })
  );

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
// PRODUCT PRICE FUNCTIONS (NOW USING PRICEHISTORY ONLY!)
// ============================================================================

/**
 * Get current price for a variant+source combination
 * NEW: Fetches latest entry from priceHistory (no more productPrices table!)
 */
export async function getCurrentPrice(
  variantId: number,
  productSourceId: number
): Promise<PriceHistory | null> {
  const result = await database
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

  return result[0] ?? null;
}

/**
 * Get all latest prices for a specific variant across all sources
 * NEW: Gets the most recent priceHistory entry for each source
 */
export async function getPricesForVariant(
  variantId: number
): Promise<PriceHistory[]> {
  // Get all unique source IDs for this variant
  const sources = await database
    .select({ productSourceId: priceHistory.productSourceId })
    .from(priceHistory)
    .where(eq(priceHistory.variantId, variantId))
    .groupBy(priceHistory.productSourceId);

  // For each source, get the latest price
  const latestPrices = await Promise.all(
    sources.map(async ({ productSourceId }) => {
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

      return latest[0];
    })
  );

  return latestPrices.filter((p): p is PriceHistory => p !== undefined);
}

/**
 * Get price comparison for a product across all sources
 * NEW: Uses latest priceHistory entries
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

  // Get variant for price lookup
  const variantRow = await database
    .select()
    .from(productVariants)
    .where(eq(productVariants.primaryProductId, productId))
    .limit(1);

  const variant = variantRow[0] ?? null;

  // Get all sources
  const sourcesData = await database
    .select({
      sourceId: productSources.id,
      domain: websites.domain,
      url: websitePages.url,
    })
    .from(productSources)
    .innerJoin(websitePages, eq(websitePages.id, productSources.websitePageId))
    .innerJoin(websites, eq(websites.id, websitePages.websiteId))
    .where(and(eq(productSources.productId, productId), eq(productSources.isActive, true)));

  // Get latest prices for each source
  const sources = await Promise.all(
    sourcesData.map(async (row) => {
      let latestPrice: PriceHistory | null = null;

      if (variant) {
        const priceResult = await database
          .select()
          .from(priceHistory)
          .where(
            and(
              eq(priceHistory.variantId, variant.id),
              eq(priceHistory.productSourceId, row.sourceId)
            )
          )
          .orderBy(desc(priceHistory.recordedAt))
          .limit(1);

        latestPrice = priceResult[0] ?? null;
      }

      return {
        sourceId: row.sourceId,
        domain: row.domain,
        url: row.url,
        price: latestPrice?.price ?? null,
        currency: latestPrice?.currency ?? "EUR",
        availability: latestPrice?.availability ?? "unknown",
        lastScraped: latestPrice?.recordedAt ?? null,
      };
    })
  );

  // Find lowest price
  let lowestPrice: PriceComparisonResult["lowestPrice"] = null;
  for (const row of sources) {
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
 * Update the updatedAt timestamp of the latest price history entry
 * This is used when price/offer stays the same - we just extend the validity period
 */
export async function touchLatestPriceHistory(
  variantId: number,
  productSourceId: number
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

  if (!latest[0]) {
    return null;
  }

  const [updated] = await database
    .update(priceHistory)
    .set({ updatedAt: new Date() })
    .where(eq(priceHistory.id, latest[0].id))
    .returning();

  return updated ?? null;
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
