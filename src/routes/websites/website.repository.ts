import { createHash } from "node:crypto";
import { URL } from "node:url";
import { database } from "@/db";
import {
  websiteElements,
  websites,
  type Website,
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

export type WebsiteSnapshot = {
  id: number;
  url: string;
  domain: string;
  path: string;
  title?: string | null;
  lastScannedAt: Date;
  elementCount: number;
  totalElements: number;
};

export type WebsiteWithStats = Website & {
  elementCount: number;
};

export type WebsiteListParams = {
  search?: string;
  domain?: string;
  limit?: number;
  offset?: number;
  orderBy?: "lastScannedAt" | "createdAt";
  sortDirection?: "asc" | "desc";
};

export type WebsiteListResult = {
  items: WebsiteWithStats[];
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

export async function listWebsites(
  params: WebsiteListParams = {}
): Promise<WebsiteListResult> {
  const {
    search,
    domain,
    limit = 20,
    offset = 0,
    orderBy = "lastScannedAt",
    sortDirection = "desc",
  } = params;

  const normalizedLimit = Math.min(Math.max(limit, 1), 200);
  const normalizedOffset = Math.max(offset, 0);

  const filters: SQL<unknown>[] = [];

  if (domain) {
    filters.push(eq(websites.domain, domain));
  }

  if (search) {
    const pattern = `%${search}%`;
    const maybeOr = or(
      ilike(websites.url, pattern),
      ilike(websites.domain, pattern),
      ilike(websites.title, pattern)
    );
    if (maybeOr) {
      filters.push(maybeOr as SQL<unknown>);
    }
  }

  const orderColumn =
    orderBy === "createdAt" ? websites.createdAt : websites.lastScannedAt;
  const orderDirection =
    sortDirection === "asc" ? asc(orderColumn) : desc(orderColumn);

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

  const listQuery = database
    .select({
      website: websites,
      elementCount: sql<number>`count(${websiteElements.id})`,
    })
    .from(websites)
    .leftJoin(websiteElements, eq(websiteElements.websiteId, websites.id));

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
    elementCount: Number(row.elementCount ?? 0),
  }));

  return {
    items,
    total,
    limit: normalizedLimit,
    offset: normalizedOffset,
  };
}

export async function getWebsiteById(
  websiteId: number
): Promise<WebsiteWithStats | null> {
  const rows = await database
    .select({
      website: websites,
      elementCount: sql<number>`count(${websiteElements.id})`,
    })
    .from(websites)
    .leftJoin(websiteElements, eq(websiteElements.websiteId, websites.id))
    .where(eq(websites.id, websiteId))
    .groupBy(websites.id)
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    ...row.website,
    elementCount: Number(row.elementCount ?? 0),
  };
}

export async function getWebsiteByUrl(
  rawUrl: string
): Promise<WebsiteWithStats | null> {
  const normalized = normalizeUrl(rawUrl);

  const rows = await database
    .select({
      website: websites,
      elementCount: sql<number>`count(${websiteElements.id})`,
    })
    .from(websites)
    .leftJoin(websiteElements, eq(websiteElements.websiteId, websites.id))
    .where(eq(websites.url, normalized.url))
    .groupBy(websites.id)
    .limit(1);

  const row = rows[0];
  if (!row) {
    return null;
  }

  return {
    ...row.website,
    elementCount: Number(row.elementCount ?? 0),
  };
}

export async function getWebsiteElements(
  websiteId: number,
  query: WebsiteElementQuery = {}
): Promise<WebsiteElementListResult> {
  const { limit = 200, offset = 0, tags, search, visible } = query;
  const normalizedLimit = Math.min(Math.max(limit, 1), 500);
  const normalizedOffset = Math.max(offset, 0);

  const filters: SQL<unknown>[] = [eq(websiteElements.websiteId, websiteId)];

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

export async function storeWebsiteSnapshot({
  url,
  title,
  html,
  elements = [],
}: SnapshotInput): Promise<WebsiteSnapshot> {
  const normalized = normalizeUrl(url);
  const contentHash = computeContentHash(html ?? undefined);
  const now = new Date();

  const storageCandidates = elements.filter((element) => {
    const tagName = element.tag.toLowerCase();
    const attrs = element.attributes || {};
    const role = element.role || "";
    const hasInteractiveAttribute = Boolean(
      attrs["href"] ??
        attrs["onclick"] ??
        attrs["data-action"] ??
        attrs["data-testid"]
    );
    const isFocusable = typeof attrs["tabindex"] !== "undefined";
    const typeValue = (element.type || "").toLowerCase();
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
  });

  const seenSelectors = new Set<string>();
  const interactiveElements = storageCandidates.filter((element) => {
    const selector = element.selector;
    if (!selector || seenSelectors.has(selector)) {
      return false;
    }
    seenSelectors.add(selector);
    return true;
  });

  const insertValues = {
    url: normalized.url,
    domain: normalized.domain,
    path: normalized.path,
    title: title ?? null,
    contentHash,
    lastScannedAt: now,
    updatedAt: now,
    createdAt: now,
  };

  const updateSet: Record<string, unknown> = {
    domain: normalized.domain,
    path: normalized.path,
    title: title ?? null,
    lastScannedAt: now,
    updatedAt: now,
  };

  if (contentHash) {
    updateSet.contentHash = contentHash;
  }

  let websiteId: number | undefined;
  let elementCount = 0;

  await database.transaction(async (trx) => {
    const upsertResult = await trx
      .insert(websites)
      .values(insertValues)
      .onConflictDoUpdate({
        target: websites.url,
        set: updateSet,
      })
      .returning({ id: websites.id });

    websiteId = upsertResult[0]?.id;
    if (!websiteId) {
      const existing = await trx
        .select({ id: websites.id })
        .from(websites)
        .where(eq(websites.url, normalized.url))
        .limit(1);
      websiteId = existing[0]?.id;
    }

    if (!websiteId) {
      throw new Error(`Failed to resolve website record for URL: ${url}`);
    }

    await trx
      .delete(websiteElements)
      .where(eq(websiteElements.websiteId, websiteId));

    if (interactiveElements.length === 0) {
      return;
    }

    const resolvedWebsiteId = websiteId as number;

    const records = interactiveElements.map((element, index) => ({
      websiteId: resolvedWebsiteId,
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

  if (!websiteId) {
    throw new Error(`Failed to resolve website record for URL: ${url}`);
  }

  return {
    id: websiteId,
    url: normalized.url,
    domain: normalized.domain,
    path: normalized.path,
    title: title ?? null,
    lastScannedAt: now,
    elementCount,
    totalElements: elements.length,
  };
}
