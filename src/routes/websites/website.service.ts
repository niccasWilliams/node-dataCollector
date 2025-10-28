import type {
  SnapshotInput,
  WebsiteElementListResult,
  WebsiteElementQuery,
  WebsiteListParams,
  WebsiteListResult,
  WebsiteSnapshot,
  WebsiteWithStats,
} from "./website.repository";
import {
  getWebsiteById,
  getWebsiteByUrl,
  getWebsiteElements as getWebsiteElementsFromRepo,
  listWebsites as listWebsitesFromRepo,
  storeWebsiteSnapshot,
} from "./website.repository";

class WebsiteService {
  async listWebsites(params: WebsiteListParams = {}): Promise<WebsiteListResult> {
    return listWebsitesFromRepo(params);
  }

  async getWebsite(websiteId: number): Promise<WebsiteWithStats | null> {
    if (!Number.isFinite(websiteId) || websiteId <= 0) {
      return null;
    }
    return getWebsiteById(websiteId);
  }

  async getWebsiteByUrl(url: string): Promise<WebsiteWithStats | null> {
    if (typeof url !== "string" || !url.trim()) {
      return null;
    }
    return getWebsiteByUrl(url);
  }

  async getWebsiteElements(
    websiteId: number,
    query: WebsiteElementQuery = {}
  ): Promise<WebsiteElementListResult | null> {
    const website = await this.getWebsite(websiteId);
    if (!website) {
      return null;
    }
    return getWebsiteElementsFromRepo(websiteId, query);
  }

  async saveSnapshot(input: SnapshotInput): Promise<WebsiteSnapshot> {
    return storeWebsiteSnapshot(input);
  }
}

export const websiteService = new WebsiteService();
export type {
  SnapshotInput,
  WebsiteListParams,
  WebsiteListResult,
  WebsiteElementQuery,
  WebsiteElementListResult,
  WebsiteSnapshot,
  WebsiteWithStats,
};
