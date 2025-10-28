import { Request, Response } from "express";
import { responseHandler } from "@/lib/communication";
import { getExternalUserIdFromRequest } from "@/util/utils";
import { browserHandler } from "@/services/browser";
import { removeSessionHistoryEntry, fetchSessionHistory } from "@/services/browser/browser.repository";
import type { ElementQueryOptions } from "@/types/browser.types";
import path from 'path';
import fs from 'fs/promises';




class BrowserController {

    async createSession(req: Request, res: Response) {
        try {
           const { config } = req.body;
            const session = await browserHandler.createSession(config || {});
            res.json({
                success: true,
                data: session,
            });
        } catch (error: any) {
            console.error("Error in createSession:", error);
            res.status(500).json({
            success: false,
            error: error.message,
            });
        }
    }


    async getSessionById(req: Request, res: Response) {
try {
    const { sessionId } = req.params;
    const session = browserHandler.getSession(sessionId);
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }
    res.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
    }

    async getSessions(req: Request, res: Response) {
        try {
    const sessions = browserHandler.getAllSessions();
    res.json({
      success: true,
      data: sessions,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
    }

    async deleteSession(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    await browserHandler.closeSession(sessionId);
    res.json({
      success: true,
      message: 'Session closed',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

    async getSessionHistory(req: Request, res: Response) {
  try {
    const { limit } = req.query;
    let parsedLimit: number | undefined;
    if (typeof limit === 'string' && limit.trim().length) {
      const value = Number(limit);
      if (!Number.isNaN(value) && value > 0) {
        parsedLimit = value;
      }
    }

    const history = await fetchSessionHistory(parsedLimit);
    res.json({
      success: true,
      data: history,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

    async deleteSessionHistoryEntry(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Ungültige Session-ID',
      });
    }

    await removeSessionHistoryEntry(sessionId);
    res.json({
      success: true,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

    async navigateToUrl(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { url, options } = req.body;
    await browserHandler.navigate(sessionId, url, options);
    const session = browserHandler.getSession(sessionId);
    res.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}


    async goBack(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    await browserHandler.goBack(sessionId);
    const session = browserHandler.getSession(sessionId);
    res.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}


async goForward(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    await browserHandler.goForward(sessionId);
    const session = browserHandler.getSession(sessionId);
    res.json({
      success: true,
      data: session,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async reload(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    await browserHandler.reload(sessionId);
    res.json({
      success: true,
      message: 'Page reloaded',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async takeScreenshot(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { fullPage, type, quality } = req.body;

    const screenshotDir = path.join(process.cwd(), 'storage', 'screenshots');
    await fs.mkdir(screenshotDir, { recursive: true });

    const timestamp = Date.now();
    const filename = `screenshot-${sessionId}-${timestamp}.${type || 'png'}`;
    const filepath = path.join(screenshotDir, filename);

    const screenshot = await browserHandler.screenshot(sessionId, {
      fullPage,
      type,
      quality,
      path: filepath,
    });

    res.json({
      success: true,
      data: {
        path: filepath,
        filename,
        size: screenshot.length,
        url: `/browser/screenshots/${filename}`,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async getFileByName(req: Request, res: Response) {
  try {
    const { filename } = req.params;
    const filepath = path.join(process.cwd(), 'storage', 'screenshots', filename);

    const file = await fs.readFile(filepath);
    const contentType = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';

    res.set('Content-Type', contentType);
    res.send(file);
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: 'Screenshot not found',
    });
  }
}


async clickElement(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { selector } = req.body;
    await browserHandler.click(sessionId, selector);
    res.json({
      success: true,
      message: 'Element clicked',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}


async typeIntoField(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { selector, text } = req.body;
    await browserHandler.type(sessionId, selector, text);
    res.json({
      success: true,
      message: 'Text typed',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async selectOption(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { selector, value } = req.body;
    await browserHandler.select(sessionId, selector, value);
    res.json({
      success: true,
      message: 'Option selected',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}



async hoverOverElement(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { selector } = req.body;
    await browserHandler.hover(sessionId, selector);
    res.json({
      success: true,
      message: 'Element hovered',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}


async scrollPage(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { x, y } = req.body;
    await browserHandler.scroll(sessionId, x || 0, y || 0);
    res.json({
      success: true,
      message: 'Page scrolled',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}


async waitForElement(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { selector, options } = req.body;
    await browserHandler.waitForSelector(sessionId, selector, options);
    res.json({
      success: true,
      message: 'Element found',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}


async getPageInfo(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const info = await browserHandler.getPageInfo(sessionId);
    res.json({
      success: true,
      data: info,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async getPageHTML(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const html = await browserHandler.getHTML(sessionId);
    res.json({
      success: true,
      data: {
        html,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async getPageElements(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { tags, includeHidden, limit } = req.query;

    const options: ElementQueryOptions = {};

    if (typeof tags === 'string' && tags.trim().length) {
      options.tags = tags.split(',').map((tag) => tag.trim()).filter(Boolean);
    } else if (Array.isArray(tags)) {
      options.tags = tags.map((tag) => String(tag).trim()).filter(Boolean);
    }

    if (typeof includeHidden === 'string') {
      options.includeHidden = includeHidden.toLowerCase() === 'true';
    }

    if (typeof limit === 'string') {
      const parsed = parseInt(limit, 10);
      if (!Number.isNaN(parsed)) {
        options.limit = parsed;
      }
    }

    const result = await browserHandler.getElements(sessionId, options);
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}


async executeScript(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { script } = req.body;

    const evalFunction = new Function(`return ${script}`)();
    const result = await browserHandler.evaluate(sessionId, evalFunction);

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async navigateAndWait(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { url, selector, options } = req.body;
    await browserHandler.navigateAndWait(sessionId, url, selector, options);
    res.json({
      success: true,
      message: 'Navigation complete and element found',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async fillForm(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { fields, submitSelector } = req.body;

    // Validierung (optional, aber nützlich)
    if (!Array.isArray(fields) || fields.length === 0) {
      throw new Error('fields must be a non-empty array');
    }
    if (typeof submitSelector !== 'string') {
      throw new Error('submitSelector must be a string');
    }

    await browserHandler.fillAndSubmit(sessionId, fields, submitSelector);

    res.json({
      success: true,
      message: 'Form filled and submitted',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}


async isLoggedIn(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const isLoggedIn = await browserHandler.isLoggedIn(sessionId);
    res.json({
      success: true,
      data: isLoggedIn,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

async logout(req: Request, res: Response) {
  try {
    const { sessionId } = req.params;
    const { selectors, keywords, waitForNavigation, timeout } = req.body || {};

    const options: Record<string, any> = {};
    if (Array.isArray(selectors)) {
      options.selectors = selectors.filter((value) => typeof value === 'string' && value.trim().length);
    }
    if (Array.isArray(keywords)) {
      options.keywords = keywords.filter((value) => typeof value === 'string' && value.trim().length);
    }
    if (typeof waitForNavigation === 'boolean') {
      options.waitForNavigation = waitForNavigation;
    }
    if (typeof timeout === 'number' && Number.isFinite(timeout)) {
      options.timeout = timeout;
    }

    const loggedOut = await browserHandler.logout(sessionId, options);
    res.json({
      success: true,
      data: {
        loggedOut,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

}

export const browserController = new BrowserController();
