import { browserHandler } from "@/services/browser";
import type { ElementQueryOptions } from "@/types/browser.types";
import type { PageElement } from "@/types/browser.types";
import {
  websiteService,
  type SnapshotInput,
  type PageSnapshot,
  type WebsiteElementListResult,
  type WebsiteElementQuery,
  type WebsiteListParams,
  type WebsiteListResult,
  type WebsitePageListParams,
  type WebsitePageListResult,
  type WebsiteWithStats,
  type WebsitePageWithStats,
} from "./website.service";

export type WebsiteElementsResponse = {
  website: WebsiteWithStats | null;
  page: WebsitePageWithStats;
  elements: WebsiteElementListResult;
};

export type SessionSnapshotOptions = ElementQueryOptions;

class WebsiteUseCase {
  // Website (Domain) Level
  async listWebsites(params: WebsiteListParams = {}): Promise<WebsiteListResult> {
    return websiteService.listWebsites(params);
  }

  async getWebsite(websiteId: number): Promise<WebsiteWithStats | null> {
    return websiteService.getWebsite(websiteId);
  }

  async getWebsiteByDomain(domain: string): Promise<WebsiteWithStats | null> {
    return websiteService.getWebsiteByDomain(domain);
  }

  // Website Page (URL/Path) Level
  async listWebsitePages(params: WebsitePageListParams = {}): Promise<WebsitePageListResult> {
    return websiteService.listWebsitePages(params);
  }

  async getWebsitePage(pageId: number): Promise<WebsitePageWithStats | null> {
    return websiteService.getWebsitePage(pageId);
  }

  async getWebsitePageByUrl(url: string): Promise<WebsitePageWithStats | null> {
    return websiteService.getWebsitePageByUrl(url);
  }

  // Website Elements
  async getWebsiteElements(
    pageId: number,
    options: WebsiteElementQuery = {}
  ): Promise<WebsiteElementsResponse | null> {
    const page = await websiteService.getWebsitePage(pageId);
    if (!page) {
      return null;
    }

    const website = await websiteService.getWebsite(page.websiteId);

    const elements = await websiteService.getWebsiteElements(pageId, options);
    if (!elements) {
      return null;
    }

    return {
      website,
      page,
      elements,
    };
  }

  // Snapshot
  async saveSnapshot(snapshot: SnapshotInput): Promise<PageSnapshot> {
    return websiteService.saveSnapshot(snapshot);
  }

  async captureSnapshotFromSession(
    sessionId: string,
    options: SessionSnapshotOptions = {}
  ): Promise<{
    page: PageSnapshot | null;
    elements: PageElement[];
  }> {
    const result = await browserHandler.getElements(sessionId, options);
    return result;
  }

  async getWebsiteSnapshotByUrl(
    url: string,
    options: WebsiteElementQuery = {}
  ): Promise<WebsiteElementsResponse | null> {
    const page = await websiteService.getWebsitePageByUrl(url);
    if (!page) {
      return null;
    }

    const website = await websiteService.getWebsite(page.websiteId);

    const elements = await websiteService.getWebsiteElements(page.id, options);
    if (!elements) {
      return {
        website,
        page,
        elements: {
          items: [],
          total: 0,
          limit: options.limit ?? 0,
          offset: options.offset ?? 0,
        },
      };
    }

    return {
      website,
      page,
      elements,
    };
  }
}

export const websiteUseCase = new WebsiteUseCase();
