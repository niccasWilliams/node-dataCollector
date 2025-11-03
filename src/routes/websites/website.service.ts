import type {
  SnapshotInput,
  PageSnapshot,
  WebsiteElementListResult,
  WebsiteElementQuery,
  WebsiteListParams,
  WebsiteListResult,
  WebsitePageListParams,
  WebsitePageListResult,
  WebsiteWithStats,
  WebsitePageWithStats,
} from "./website.repository";
import {
  getWebsiteById,
  getWebsiteByDomain,
  getWebsitePageById,
  getWebsitePageByUrl,
  getWebsiteElements as getWebsiteElementsFromRepo,
  listWebsites as listWebsitesFromRepo,
  listWebsitePages as listWebsitePagesFromRepo,
  storeWebsiteSnapshot,
} from "./website.repository";

class WebsiteService {
  // Website (Domain) Level
  async listWebsites(params: WebsiteListParams = {}): Promise<WebsiteListResult> {
    return listWebsitesFromRepo(params);
  }

  async getWebsite(websiteId: number): Promise<WebsiteWithStats | null> {
    if (!Number.isFinite(websiteId) || websiteId <= 0) {
      return null;
    }
    return getWebsiteById(websiteId);
  }

  async getWebsiteByDomain(domain: string): Promise<WebsiteWithStats | null> {
    if (typeof domain !== "string" || !domain.trim()) {
      return null;
    }
    return getWebsiteByDomain(domain);
  }

  // Website Page (URL/Path) Level
  async listWebsitePages(params: WebsitePageListParams = {}): Promise<WebsitePageListResult> {
    return listWebsitePagesFromRepo(params);
  }

  async getWebsitePage(pageId: number): Promise<WebsitePageWithStats | null> {
    if (!Number.isFinite(pageId) || pageId <= 0) {
      return null;
    }
    return getWebsitePageById(pageId);
  }

  async getWebsitePageByUrl(url: string): Promise<WebsitePageWithStats | null> {
    if (typeof url !== "string" || !url.trim()) {
      return null;
    }
    return getWebsitePageByUrl(url);
  }

  // Website Elements
  async getWebsiteElements(
    pageId: number,
    query: WebsiteElementQuery = {}
  ): Promise<WebsiteElementListResult | null> {
    const page = await this.getWebsitePage(pageId);
    if (!page) {
      return null;
    }
    return getWebsiteElementsFromRepo(pageId, query);
  }

  // Snapshot
  async saveSnapshot(input: SnapshotInput): Promise<PageSnapshot> {
    return storeWebsiteSnapshot(input);
  }
}

export const websiteService = new WebsiteService();
export type {
  SnapshotInput,
  PageSnapshot,
  WebsiteListParams,
  WebsiteListResult,
  WebsitePageListParams,
  WebsitePageListResult,
  WebsiteElementQuery,
  WebsiteElementListResult,
  WebsiteWithStats,
  WebsitePageWithStats,
};
