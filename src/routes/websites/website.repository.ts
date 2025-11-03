import { createHash } from "node:crypto";
import { URL } from "node:url";
import { database } from "@/db";
import {
  websites,
  websitePages,
  websiteElements,
  type Website,
  type WebsitePage,
  type WebsiteElement,
} from "@/db/individual/individual-schema";
import type { PageElement } from "@/types/browser.types";
import {
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

/**
 * Interactive Tags that we want to store
 */
export const INTERACTIVE_TAGS = [
  "a",
  "button",
  "form",
  "input",
  "label",
  "select",
  "textarea",
  "option",
];

const INTERACTIVE_TAGS_SET = new Set(INTERACTIVE_TAGS);
const INTERACTIVE_INPUT_TYPES = new Set([
  "button",
  "submit",
  "reset",
  "email",
  "password",
  "text",
  "number",
  "search",
  "tel",
  "url",
  "checkbox",
  "radio",
  "file",
]);
const INTERACTIVE_ROLE_PATTERN =
  /(button|link|menuitem|tab|checkbox|radio|textbox|combobox|switch|option)/i;

// ============================================================================
// TYPES
// ============================================================================

export type SnapshotInput = {
  url: string;
  title?: string | null;
  html?: string;
  elements?: PageElement[];
};

type NormalizedUrl = {
  url: string;
  domain: string;
  path: string;
};

export type PageSnapshot = {
  websiteId: number;
  pageId: number;
  url: string;
  domain: string;
  path: string;
  title?: string | null;
  lastScannedAt: Date;
  elementCount: number;
  totalElements: number;
};

export type WebsiteWithStats = Website & {
  pageCount: number;
  elementCount: number;
};

export type WebsitePageWithStats = WebsitePage & {
  elementCount: number;
  domain: string;
};

export type WebsiteListParams = {
  search?: string;
  domain?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: "createdAt" | "updatedAt";
  sortDirection?: "asc" | "desc";
};

export type WebsiteListResult = {
  items: WebsiteWithStats[];
  total: number;
  limit: number;
  offset: number;
};

export type WebsitePageListParams = {
  websiteId?: number;
  search?: string;
  limit?: number;
  offset?: number;
  orderBy?: "lastScannedAt" | "createdAt" | "scanCount";
  sortDirection?: "asc" | "desc";
};

export type WebsitePageListResult = {
  items: WebsitePageWithStats[];
  total: number;
  limit: number;
  offset: number;
};

export type WebsiteElementQuery = {
  limit?: number;
  offset?: number;
  tags?: string[];
  search?: string;
  visible?: boolean;
};

export type WebsiteElementListResult = {
  items: WebsiteElement[];
  total: number;
  limit: number;
  offset: number;
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function normalizeUrl(rawUrl: string): NormalizedUrl {
  const parsed = new URL(rawUrl);
  parsed.hash = "";
  parsed.search = "";

  let pathname = parsed.pathname || "/";
  if (pathname !== "/" && pathname.endsWith("/")) {
    pathname = pathname.slice(0, -1);
  }
  parsed.pathname = pathname;

  return {
    url: parsed.toString(),
    domain: parsed.hostname,
    path: pathname || "/",
  };
}

function computeContentHash(html?: string): string | null {
  if (!html) return null;
  return createHash("sha256").update(html).digest("hex");
}

function isInteractiveElement(element: PageElement): boolean {
  const tagName = element.tag.toLowerCase();
  const attrs = element.attributes || {};
  const role = element.role || "";
  const typeValue = (element.type || "").toLowerCase();

  const hasInteractiveAttribute = Boolean(
    attrs["href"] ??
      attrs["onclick"] ??
      attrs["data-action"] ??
      attrs["data-testid"]
  );
  const isFocusable = typeof attrs["tabindex"] !== "undefined";
  const isInteractiveTag = INTERACTIVE_TAGS_SET.has(tagName);
  const hasInteractiveRole = role ? INTERACTIVE_ROLE_PATTERN.test(role) : false;
  const isInteractiveInput = typeValue
    ? INTERACTIVE_INPUT_TYPES.has(typeValue)
    : false;

  return (
    isInteractiveTag ||
    hasInteractiveAttribute ||
    isFocusable ||
    hasInteractiveRole ||
    isInteractiveInput
  );
}

// ============================================================================
// WEBSITE FUNCTIONS (Domain Level)
// ============================================================================

/**
 * Get or create a website by domain
 */
export async function getOrCreateWebsite(
  domain: string,
  data?: { name?: string; description?: string; metadata?: Record<string, unknown> }
): Promise<Website> {
  const existing = await database
    .select()
    .from(websites)
    .where(eq(websites.domain, domain))
    .limit(1);

  if (existing[0]) {
    return existing[0];
  }

  const now = new Date();
  const [created] = await database
    .insert(websites)
    .values({
      domain,
      name: data?.name ?? null,
      description: data?.description ?? null,
      metadata: data?.metadata ?? {},
      isActive: true,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  if (!created) {
    throw new Error(`Failed to create website for domain: ${domain}`);
  }

  return created;
}

/**
 * List all websites with stats
 */
export async function listWebsites(
  params: WebsiteListParams = {}
): Promise<WebsiteListResult> {
  const {
    search,
    domain,
    isActive,
    limit = 20,
    offset = 0,
    orderBy = "updatedAt",
    sortDirection = "desc",
  } = params;

  const normalizedLimit = Math.min(Math.max(limit, 1), 200);
  const normalizedOffset = Math.max(offset, 0);

  const filters: SQL<unknown>[] = [];

  if (domain) {
    filters.push(eq(websites.domain, domain));
  }

  if (typeof isActive === "boolean") {
    filters.push(eq(websites.isActive, isActive));
  }

  if (search) {
    const pattern = `%${search}%`;
    const maybeOr = or(
      ilike(websites.domain, pattern),
      ilike(websites.name, pattern),
      ilike(websites.description, pattern)
    );
    if (maybeOr) {
      filters.push(maybeOr as SQL<unknown>);
    }
  }

  const orderColumn =
    orderBy === "createdAt" ? websites.createdAt : websites.updatedAt;
  const orderDirection =
    sortDirection === "asc" ? asc(orderColumn) : desc(orderColumn);

  // Get total count
  const totalQuery = database
    .select({ count: sql<number>`count(*)` })
    .from(websites);
  if (filters.length > 0) {
    const computedWhere = and(...filters);
    if (computedWhere) {
      totalQuery.where(computedWhere as SQL<unknown>);
    }
  }
  const totalResult = await totalQuery;
  const total = Number(totalResult[0]?.count ?? 0);

  // Get websites with stats
  const listQuery = database
    .select({
      website: websites,
      pageCount: sql<number>`count(distinct ${websitePages.id})`,
      elementCount: sql<number>`count(distinct ${websiteElements.id})`,
    })
    .from(websites)
    .leftJoin(websitePages, eq(websitePages.websiteId, websites.id))
    .leftJoin(websiteElements, eq(websiteElements.pageId, websitePages.id));

  if (filters.length > 0) {
    const computedWhere = and(...filters);
    if (computedWhere) {
      listQuery.where(computedWhere as SQL<unknown>);
    }
  }

  const rows = await listQuery
    .groupBy(websites.id)
    .orderBy(orderDirection)
    .limit(normalizedLimit)
    .offset(normalizedOffset);

  const items: WebsiteWithStats[] = rows.map((row) => ({
    ...row.website,
    pageCount: Number(row.pageCount ?? 0),
    elementCount: Number(row.elementCount ?? 0),
  }));

  return {
    items,
    total,
    limit: normalizedLimit,
    offset: normalizedOffset,
  };
}

/**
 * Get website by ID with stats
 */
export async function getWebsiteById(
  websiteId: number
): Promise<WebsiteWithStats | null> {
  const rows = await database
    .select({
      website: websites,
      pageCount: sql<number>`count(distinct ${websitePages.id})`,
      elementCount: sql<number>`count(distinct ${websiteElements.id})`,
    })
    .from(websites)
    .leftJoin(websitePages, eq(websitePages.websiteId, websites.id))
    .leftJoin(websiteElements, eq(websiteElements.pageId, websitePages.id))
    .where(eq(websites.id, websiteId))
    .groupBy(websites.id)
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    ...row.website,
    pageCount: Number(row.pageCount ?? 0),
    elementCount: Number(row.elementCount ?? 0),
  };
}

/**
 * Get website by domain
 */
export async function getWebsiteByDomain(
  domain: string
): Promise<WebsiteWithStats | null> {
  const rows = await database
    .select({
      website: websites,
      pageCount: sql<number>`count(distinct ${websitePages.id})`,
      elementCount: sql<number>`count(distinct ${websiteElements.id})`,
    })
    .from(websites)
    .leftJoin(websitePages, eq(websitePages.websiteId, websites.id))
    .leftJoin(websiteElements, eq(websiteElements.pageId, websitePages.id))
    .where(eq(websites.domain, domain))
    .groupBy(websites.id)
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    ...row.website,
    pageCount: Number(row.pageCount ?? 0),
    elementCount: Number(row.elementCount ?? 0),
  };
}

// ============================================================================
// WEBSITE PAGE FUNCTIONS (URL/Path Level)
// ============================================================================

/**
 * List pages for a website or all pages
 */
export async function listWebsitePages(
  params: WebsitePageListParams = {}
): Promise<WebsitePageListResult> {
  const {
    websiteId,
    search,
    limit = 20,
    offset = 0,
    orderBy = "lastScannedAt",
    sortDirection = "desc",
  } = params;

  const normalizedLimit = Math.min(Math.max(limit, 1), 200);
  const normalizedOffset = Math.max(offset, 0);

  const filters: SQL<unknown>[] = [];

  if (websiteId) {
    filters.push(eq(websitePages.websiteId, websiteId));
  }

  if (search) {
    const pattern = `%${search}%`;
    const maybeOr = or(
      ilike(websitePages.url, pattern),
      ilike(websitePages.path, pattern),
      ilike(websitePages.title, pattern)
    );
    if (maybeOr) {
      filters.push(maybeOr as SQL<unknown>);
    }
  }

  const orderColumn =
    orderBy === "createdAt"
      ? websitePages.createdAt
      : orderBy === "scanCount"
      ? websitePages.scanCount
      : websitePages.lastScannedAt;
  const orderDirection =
    sortDirection === "asc" ? asc(orderColumn) : desc(orderColumn);

  // Get total count
  const totalQuery = database
    .select({ count: sql<number>`count(*)` })
    .from(websitePages);
  if (filters.length > 0) {
    const computedWhere = and(...filters);
    if (computedWhere) {
      totalQuery.where(computedWhere as SQL<unknown>);
    }
  }
  const totalResult = await totalQuery;
  const total = Number(totalResult[0]?.count ?? 0);

  // Get pages with stats
  const listQuery = database
    .select({
      page: websitePages,
      domain: websites.domain,
      elementCount: sql<number>`count(${websiteElements.id})`,
    })
    .from(websitePages)
    .innerJoin(websites, eq(websites.id, websitePages.websiteId))
    .leftJoin(websiteElements, eq(websiteElements.pageId, websitePages.id));

  if (filters.length > 0) {
    const computedWhere = and(...filters);
    if (computedWhere) {
      listQuery.where(computedWhere as SQL<unknown>);
    }
  }

  const rows = await listQuery
    .groupBy(websitePages.id, websites.domain)
    .orderBy(orderDirection)
    .limit(normalizedLimit)
    .offset(normalizedOffset);

  const items: WebsitePageWithStats[] = rows.map((row) => ({
    ...row.page,
    domain: row.domain,
    elementCount: Number(row.elementCount ?? 0),
  }));

  return {
    items,
    total,
    limit: normalizedLimit,
    offset: normalizedOffset,
  };
}

/**
 * Get page by ID with stats
 */
export async function getWebsitePageById(
  pageId: number
): Promise<WebsitePageWithStats | null> {
  const rows = await database
    .select({
      page: websitePages,
      domain: websites.domain,
      elementCount: sql<number>`count(${websiteElements.id})`,
    })
    .from(websitePages)
    .innerJoin(websites, eq(websites.id, websitePages.websiteId))
    .leftJoin(websiteElements, eq(websiteElements.pageId, websitePages.id))
    .where(eq(websitePages.id, pageId))
    .groupBy(websitePages.id, websites.domain)
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    ...row.page,
    domain: row.domain,
    elementCount: Number(row.elementCount ?? 0),
  };
}

/**
 * Get page by URL
 */
export async function getWebsitePageByUrl(
  rawUrl: string
): Promise<WebsitePageWithStats | null> {
  const normalized = normalizeUrl(rawUrl);

  const rows = await database
    .select({
      page: websitePages,
      domain: websites.domain,
      elementCount: sql<number>`count(${websiteElements.id})`,
    })
    .from(websitePages)
    .innerJoin(websites, eq(websites.id, websitePages.websiteId))
    .leftJoin(websiteElements, eq(websiteElements.pageId, websitePages.id))
    .where(eq(websitePages.url, normalized.url))
    .groupBy(websitePages.id, websites.domain)
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    ...row.page,
    domain: row.domain,
    elementCount: Number(row.elementCount ?? 0),
  };
}

// ============================================================================
// WEBSITE ELEMENT FUNCTIONS
// ============================================================================

/**
 * Get elements for a page
 */
export async function getWebsiteElements(
  pageId: number,
  query: WebsiteElementQuery = {}
): Promise<WebsiteElementListResult> {
  const { limit = 200, offset = 0, tags, search, visible } = query;
  const normalizedLimit = Math.min(Math.max(limit, 1), 500);
  const normalizedOffset = Math.max(offset, 0);

  const filters: SQL<unknown>[] = [eq(websiteElements.pageId, pageId)];

  if (typeof visible === "boolean") {
    filters.push(eq(websiteElements.visible, visible));
  }

  if (tags && tags.length > 0) {
    filters.push(inArray(websiteElements.tagName, tags));
  }

  if (search) {
    const pattern = `%${search}%`;
    const condition = or(
      ilike(websiteElements.textContent, pattern),
      ilike(websiteElements.cssSelector, pattern),
      ilike(websiteElements.role, pattern)
    );
    if (condition) {
      filters.push(condition as SQL<unknown>);
    }
  }

  const whereClause = and(...filters);
  if (!whereClause) {
    throw new Error("Failed to build website element filter");
  }
  const ensuredWhereClause = whereClause as SQL<unknown>;

  const totalResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(websiteElements)
    .where(ensuredWhereClause);

  const total = Number(totalResult[0]?.count ?? 0);

  const items = await database
    .select()
    .from(websiteElements)
    .where(ensuredWhereClause)
    .orderBy(asc(websiteElements.orderIndex))
    .limit(normalizedLimit)
    .offset(normalizedOffset);

  return {
    items,
    total,
    limit: normalizedLimit,
    offset: normalizedOffset,
  };
}

// ============================================================================
// SNAPSHOT FUNCTION (Main Entry Point)
// ============================================================================

/**
 * Store a complete website snapshot
 * This creates/updates: Website (domain) -> Page (url) -> Elements
 */
export async function storeWebsiteSnapshot({
  url,
  title,
  html,
  elements = [],
}: SnapshotInput): Promise<PageSnapshot> {
  const normalized = normalizeUrl(url);
  const contentHash = computeContentHash(html ?? undefined);
  const now = new Date();

  // Filter to only interactive elements
  const storageCandidates = elements.filter(isInteractiveElement);

  // Remove duplicates by selector
  const seenSelectors = new Set<string>();
  const interactiveElements = storageCandidates.filter((element) => {
    const selector = element.selector;
    if (!selector || seenSelectors.has(selector)) {
      return false;
    }
    seenSelectors.add(selector);
    return true;
  });

  let websiteId: number | undefined;
  let pageId: number | undefined;
  let elementCount = 0;

  await database.transaction(async (trx) => {
    // 1. Get or create website (domain level)
    const existingWebsite = await trx
      .select()
      .from(websites)
      .where(eq(websites.domain, normalized.domain))
      .limit(1);

    if (existingWebsite[0]) {
      websiteId = existingWebsite[0].id;
    } else {
      const [createdWebsite] = await trx
        .insert(websites)
        .values({
          domain: normalized.domain,
          name: null,
          description: null,
          metadata: {},
          isActive: true,
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: websites.id });

      websiteId = createdWebsite?.id;
    }

    if (!websiteId) {
      throw new Error(`Failed to create/get website for domain: ${normalized.domain}`);
    }

    // 2. Upsert page (url/path level)
    const pageInsertValues = {
      websiteId: websiteId,
      url: normalized.url,
      path: normalized.path,
      title: title ?? null,
      contentHash,
      htmlSnapshot: html ?? null,
      metadata: {},
      lastScannedAt: now,
      scanCount: 1,
      createdAt: now,
      updatedAt: now,
    };

    const pageUpdateSet: Record<string, unknown> = {
      title: title ?? null,
      lastScannedAt: now,
      scanCount: sql`${websitePages.scanCount} + 1`,
      updatedAt: now,
    };

    if (contentHash) {
      pageUpdateSet.contentHash = contentHash;
    }

    if (html) {
      pageUpdateSet.htmlSnapshot = html;
    }

    const upsertResult = await trx
      .insert(websitePages)
      .values(pageInsertValues)
      .onConflictDoUpdate({
        target: websitePages.url,
        set: pageUpdateSet,
      })
      .returning({ id: websitePages.id });

    pageId = upsertResult[0]?.id;
    if (!pageId) {
      const existing = await trx
        .select({ id: websitePages.id })
        .from(websitePages)
        .where(eq(websitePages.url, normalized.url))
        .limit(1);
      pageId = existing[0]?.id;
    }

    if (!pageId) {
      throw new Error(`Failed to resolve page record for URL: ${url}`);
    }

    // 3. Delete old elements for this page
    await trx.delete(websiteElements).where(eq(websiteElements.pageId, pageId));

    // 4. Insert new elements
    if (interactiveElements.length === 0) {
      return;
    }

    const resolvedPageId = pageId as number;

    const records = interactiveElements.map((element, index) => ({
      pageId: resolvedPageId,
      tagName: element.tag,
      cssSelector: element.selector,
      attributes: element.attributes ?? {},
      classes: element.classes ?? [],
      textContent: element.text ?? null,
      nameAttr: element.name ?? null,
      href: element.href ?? null,
      typeAttr: element.type ?? null,
      role: element.role ?? null,
      formAction: element.formAction ?? null,
      visible: Boolean(element.visible),
      disabled: Boolean(element.disabled),
      boundingBox: element.boundingBox ?? null,
      orderIndex: index,
      createdAt: now,
      updatedAt: now,
    }));

    if (records.length > 0) {
      await trx.insert(websiteElements).values(records);
      elementCount = records.length;
    }
  });

  if (!websiteId || !pageId) {
    throw new Error(`Failed to resolve website/page records for URL: ${url}`);
  }

  return {
    websiteId,
    pageId,
    url: normalized.url,
    domain: normalized.domain,
    path: normalized.path,
    title: title ?? null,
    lastScannedAt: now,
    elementCount,
    totalElements: elements.length,
  };
}
