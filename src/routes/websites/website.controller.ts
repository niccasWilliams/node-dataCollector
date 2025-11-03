import type { Request, Response } from "express";
import type { ElementQueryOptions } from "@/types/browser.types";
import { websiteUseCase } from "./website.useCase";

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "true") return true;
    if (lower === "false") return false;
  }
  if (typeof value === "boolean") {
    return value;
  }
  return undefined;
}

class WebsiteController {
  async listWebsites(req: Request, res: Response) {
    try {
      const { search, domain, orderBy, sortDirection } = req.query;
      const limit = parseNumber(req.query.limit);
      const offset = parseNumber(req.query.offset);

      const result = await websiteUseCase.listWebsites({
        search: typeof search === "string" ? search : undefined,
        domain: typeof domain === "string" ? domain : undefined,
        limit,
        offset,
        orderBy:
          orderBy === "createdAt" || orderBy === "updatedAt"
            ? orderBy
            : undefined,
        sortDirection:
          sortDirection === "asc" || sortDirection === "desc"
            ? sortDirection
            : undefined,
      });

      res.json({
        success: true,
        data: result.items,
        meta: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
        },
      });
    } catch (error) {
      console.error("[WebsiteController] listWebsites failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch websites",
      });
    }
  }

  async getWebsiteByUrl(req: Request, res: Response) {
    try {
      const { url, limit } = req.query;
      if (typeof url !== "string" || !url.trim()) {
        return res.status(400).json({
          success: false,
          error: "Parameter 'url' ist erforderlich.",
        });
      }

      const elementLimit = parseNumber(limit) ?? 50;

      const result = await websiteUseCase.getWebsiteSnapshotByUrl(url, {
        limit: elementLimit,
      });

      if (!result) {
        return res.status(404).json({
          success: false,
          error: "Kein Snapshot für diese URL gefunden.",
        });
      }

      res.json({
        success: true,
        data: {
          website: result.website,
          page: result.page,
          elements: result.elements.items,
        },
        meta: {
          total: result.elements.total,
          limit: result.elements.limit,
          offset: result.elements.offset,
        },
      });
    } catch (error) {
      console.error("[WebsiteController] getWebsiteByUrl failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to resolve website",
      });
    }
  }

  async getWebsiteById(req: Request, res: Response) {
    try {
      const websiteId = Number(req.params.websiteId);
      if (!Number.isFinite(websiteId) || websiteId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid website id",
        });
      }

      const website = await websiteUseCase.getWebsite(websiteId);
      if (!website) {
        return res.status(404).json({
          success: false,
          error: "Website not found",
        });
      }

      res.json({
        success: true,
        data: website,
      });
    } catch (error) {
      console.error("[WebsiteController] getWebsiteById failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch website",
      });
    }
  }

  async getWebsiteElements(req: Request, res: Response) {
    try {
      const websiteId = Number(req.params.websiteId);
      if (!Number.isFinite(websiteId) || websiteId <= 0) {
        return res.status(400).json({
          success: false,
          error: "Invalid website id",
        });
      }

      const { tags, search } = req.query;
      const limit = parseNumber(req.query.limit);
      const offset = parseNumber(req.query.offset);
      const visible = parseBoolean(req.query.visible);

      const tagList: string[] | undefined = (() => {
        if (typeof tags === "string" && tags.trim().length > 0) {
          return tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean);
        }
        if (Array.isArray(tags)) {
          return tags
            .map((tag) => String(tag).trim())
            .filter(Boolean);
        }
        return undefined;
      })();

      const result = await websiteUseCase.getWebsiteElements(websiteId, {
        tags: tagList,
        search: typeof search === "string" ? search : undefined,
        limit,
        offset,
        visible,
      });

      if (!result) {
        return res.status(404).json({
          success: false,
          error: "Website not found",
        });
      }

      res.json({
        success: true,
        data: {
          website: result.website,
          page: result.page,
          elements: result.elements.items,
        },
        meta: {
          total: result.elements.total,
          limit: result.elements.limit,
          offset: result.elements.offset,
        },
      });
    } catch (error) {
      console.error("[WebsiteController] getWebsiteElements failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch website elements",
      });
    }
  }

  async captureSessionSnapshot(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      if (!sessionId || typeof sessionId !== "string") {
        return res.status(400).json({
          success: false,
          error: "Session id is required",
        });
      }

      const { tags, includeHidden, limit } = req.body ?? {};

      const options: ElementQueryOptions = {};
      if (Array.isArray(tags)) {
        options.tags = tags
          .map((tag: unknown) => (typeof tag === "string" ? tag.trim() : ""))
          .filter(Boolean);
      }
      if (typeof includeHidden === "boolean") {
        options.includeHidden = includeHidden;
      }
      if (typeof limit === "number" && Number.isFinite(limit)) {
        options.limit = limit;
      }

      const { page, elements } =
        await websiteUseCase.captureSnapshotFromSession(sessionId, options);

      res.json({
        success: true,
        data: {
          page,
          elements,
        },
      });
    } catch (error) {
      console.error("[WebsiteController] captureSessionSnapshot failed", error);
      res.status(500).json({
        success: false,
        error: "Failed to capture snapshot",
      });
    }
  }
}

export const websiteController = new WebsiteController();
