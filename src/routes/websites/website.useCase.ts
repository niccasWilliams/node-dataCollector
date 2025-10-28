import { browserHandler } from "@/services/browser";
import type { ElementQueryOptions } from "@/types/browser.types";
import type { PageElement } from "@/types/browser.types";
import {
  websiteService,
  type SnapshotInput,
  type WebsiteElementListResult,
  type WebsiteElementQuery,
  type WebsiteListParams,
  type WebsiteListResult,
  type WebsiteSnapshot,
  type WebsiteWithStats,
} from "./website.service";

export type WebsiteElementsResponse = {
  website: WebsiteWithStats;
  elements: WebsiteElementListResult;
};

export type SessionSnapshotOptions = ElementQueryOptions;

class WebsiteUseCase {
  async listWebsites(params: WebsiteListParams = {}): Promise<WebsiteListResult> {
    return websiteService.listWebsites(params);
  }

  async getWebsite(websiteId: number): Promise<WebsiteWithStats | null> {
    return websiteService.getWebsite(websiteId);
  }

  async getWebsiteElements(
    websiteId: number,
    options: WebsiteElementQuery = {}
  ): Promise<WebsiteElementsResponse | null> {
    const website = await websiteService.getWebsite(websiteId);
    if (!website) {
      return null;
    }

    const elements = await websiteService.getWebsiteElements(websiteId, options);
    if (!elements) {
      return null;
    }

    return {
      website,
      elements,
    };
  }

  async saveSnapshot(snapshot: SnapshotInput): Promise<WebsiteSnapshot> {
    return websiteService.saveSnapshot(snapshot);
  }

  async captureSnapshotFromSession(
    sessionId: string,
    options: SessionSnapshotOptions = {}
  ): Promise<{
    website: WebsiteSnapshot | null;
    elements: PageElement[];
  }> {
    const result = await browserHandler.getElements(sessionId, options);
    return result;
  }

  async getWebsiteSnapshotByUrl(
    url: string,
    options: WebsiteElementQuery = {}
  ): Promise<WebsiteElementsResponse | null> {
    const website = await websiteService.getWebsiteByUrl(url);
    if (!website) {
      return null;
    }

    const elements = await websiteService.getWebsiteElements(website.id, options);
    if (!elements) {
      return {
        website,
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
      elements,
    };
  }
}

export const websiteUseCase = new WebsiteUseCase();
