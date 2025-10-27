import { Elysia, t } from 'elysia';
import { browserController } from '../../services/browser';
import path from 'path';
import fs from 'fs/promises';

/**
 * Browser automation API routes
 *
 * Provides REST endpoints for browser control:
 * - Session management
 * - Navigation
 * - Screenshots
 * - Page interaction
 * - Data extraction
 */
export const browserRoutes = new Elysia({ prefix: '/browser' })
  // Session Management
  .post(
    '/session',
    async ({ body }) => {
      const session = await browserController.createSession(body.config);
      return {
        success: true,
        data: session,
      };
    },
    {
      body: t.Object({
        config: t.Optional(
          t.Object({
            headless: t.Optional(t.Boolean()),
            slowMo: t.Optional(t.Number()),
            viewport: t.Optional(
              t.Object({
                width: t.Number(),
                height: t.Number(),
              })
            ),
          })
        ),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Create new browser session',
        description: 'Starts a new browser instance with the specified configuration',
      },
    }
  )

  .get(
    '/session/:sessionId',
    async ({ params: { sessionId } }) => {
      const session = browserController.getSession(sessionId);
      if (!session) {
        return {
          success: false,
          error: 'Session not found',
        };
      }
      return {
        success: true,
        data: session,
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Get session info',
        description: 'Retrieve information about a browser session',
      },
    }
  )

  .get(
    '/sessions',
    async () => {
      const sessions = browserController.getAllSessions();
      return {
        success: true,
        data: sessions,
      };
    },
    {
      detail: {
        tags: ['Browser'],
        summary: 'Get all sessions',
        description: 'Retrieve all active browser sessions',
      },
    }
  )

  .delete(
    '/session/:sessionId',
    async ({ params: { sessionId } }) => {
      await browserController.closeSession(sessionId);
      return {
        success: true,
        message: 'Session closed',
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Close session',
        description: 'Close a browser session',
      },
    }
  )

  // Navigation
  .post(
    '/session/:sessionId/navigate',
    async ({ params: { sessionId }, body }) => {
      await browserController.navigate(sessionId, body.url, body.options);
      const session = browserController.getSession(sessionId);
      return {
        success: true,
        data: session,
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        url: t.String(),
        options: t.Optional(
          t.Object({
            waitUntil: t.Optional(
              t.Union([
                t.Literal('load'),
                t.Literal('domcontentloaded'),
                t.Literal('networkidle'),
                t.Literal('commit'),
              ])
            ),
            timeout: t.Optional(t.Number()),
          })
        ),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Navigate to URL',
        description: 'Navigate the browser to a specific URL',
      },
    }
  )

  .post(
    '/session/:sessionId/back',
    async ({ params: { sessionId } }) => {
      await browserController.goBack(sessionId);
      const session = browserController.getSession(sessionId);
      return {
        success: true,
        data: session,
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Go back',
        description: 'Navigate back in browser history',
      },
    }
  )

  .post(
    '/session/:sessionId/forward',
    async ({ params: { sessionId } }) => {
      await browserController.goForward(sessionId);
      const session = browserController.getSession(sessionId);
      return {
        success: true,
        data: session,
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Go forward',
        description: 'Navigate forward in browser history',
      },
    }
  )

  .post(
    '/session/:sessionId/reload',
    async ({ params: { sessionId } }) => {
      await browserController.reload(sessionId);
      return {
        success: true,
        message: 'Page reloaded',
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Reload page',
        description: 'Reload the current page',
      },
    }
  )

  // Screenshots
  .post(
    '/session/:sessionId/screenshot',
    async ({ params: { sessionId }, body }) => {
      const screenshotDir = path.join(process.cwd(), 'storage', 'screenshots');
      await fs.mkdir(screenshotDir, { recursive: true });

      const timestamp = Date.now();
      const filename = `screenshot-${sessionId}-${timestamp}.${body.type || 'png'}`;
      const filepath = path.join(screenshotDir, filename);

      const screenshot = await browserController.screenshot(sessionId, {
        ...body,
        path: filepath,
      });

      return {
        success: true,
        data: {
          path: filepath,
          filename,
          size: screenshot.length,
          url: `/browser/screenshots/${filename}`,
        },
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        fullPage: t.Optional(t.Boolean()),
        type: t.Optional(t.Union([t.Literal('png'), t.Literal('jpeg')])),
        quality: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Take screenshot',
        description: 'Capture a screenshot of the current page',
      },
    }
  )

  .get(
    '/screenshots/:filename',
    async ({ params: { filename } }) => {
      const filepath = path.join(process.cwd(), 'storage', 'screenshots', filename);
      try {
        const file = await fs.readFile(filepath);
        return new Response(file, {
          headers: {
            'Content-Type': filename.endsWith('.png') ? 'image/png' : 'image/jpeg',
          },
        });
      } catch (error) {
        return {
          success: false,
          error: 'Screenshot not found',
        };
      }
    },
    {
      params: t.Object({
        filename: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Get screenshot',
        description: 'Retrieve a saved screenshot',
      },
    }
  )

  // Page Interaction
  .post(
    '/session/:sessionId/click',
    async ({ params: { sessionId }, body }) => {
      await browserController.click(sessionId, body.selector);
      return {
        success: true,
        message: 'Element clicked',
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        selector: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Click element',
        description: 'Click on an element specified by CSS selector',
      },
    }
  )

  .post(
    '/session/:sessionId/type',
    async ({ params: { sessionId }, body }) => {
      await browserController.type(sessionId, body.selector, body.text);
      return {
        success: true,
        message: 'Text typed',
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        selector: t.String(),
        text: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Type text',
        description: 'Type text into an input field',
      },
    }
  )

  .post(
    '/session/:sessionId/select',
    async ({ params: { sessionId }, body }) => {
      await browserController.select(sessionId, body.selector, body.value);
      return {
        success: true,
        message: 'Option selected',
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        selector: t.String(),
        value: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Select option',
        description: 'Select an option from a dropdown',
      },
    }
  )

  .post(
    '/session/:sessionId/hover',
    async ({ params: { sessionId }, body }) => {
      await browserController.hover(sessionId, body.selector);
      return {
        success: true,
        message: 'Element hovered',
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        selector: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Hover element',
        description: 'Hover over an element',
      },
    }
  )

  .post(
    '/session/:sessionId/scroll',
    async ({ params: { sessionId }, body }) => {
      await browserController.scroll(sessionId, body.x, body.y);
      return {
        success: true,
        message: 'Page scrolled',
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        x: t.Optional(t.Number()),
        y: t.Optional(t.Number()),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Scroll page',
        description: 'Scroll the page to specific coordinates',
      },
    }
  )

  .post(
    '/session/:sessionId/wait',
    async ({ params: { sessionId }, body }) => {
      await browserController.waitForSelector(sessionId, body.selector, body.options);
      return {
        success: true,
        message: 'Element found',
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        selector: t.String(),
        options: t.Optional(
          t.Object({
            timeout: t.Optional(t.Number()),
            state: t.Optional(
              t.Union([
                t.Literal('attached'),
                t.Literal('detached'),
                t.Literal('visible'),
                t.Literal('hidden'),
              ])
            ),
          })
        ),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Wait for element',
        description: 'Wait for an element to appear',
      },
    }
  )

  // Page Info & Data
  .get(
    '/session/:sessionId/info',
    async ({ params: { sessionId } }) => {
      const info = await browserController.getPageInfo(sessionId);
      return {
        success: true,
        data: info,
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Get page info',
        description: 'Get current page information (URL, title, cookies, etc.)',
      },
    }
  )

  .get(
    '/session/:sessionId/html',
    async ({ params: { sessionId } }) => {
      const html = await browserController.getHTML(sessionId);
      return {
        success: true,
        data: {
          html,
        },
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Get page HTML',
        description: 'Get the current page HTML',
      },
    }
  )

  .post(
    '/session/:sessionId/evaluate',
    async ({ params: { sessionId }, body }) => {
      const result = await browserController.evaluate(sessionId, body.script);
      return {
        success: true,
        data: result,
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        script: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Execute JavaScript',
        description: 'Execute custom JavaScript in the page context',
      },
    }
  )

  // Helper routes for common workflows
  .post(
    '/session/:sessionId/navigate-and-wait',
    async ({ params: { sessionId }, body }) => {
      await browserController.navigateAndWait(
        sessionId,
        body.url,
        body.selector,
        body.options
      );
      return {
        success: true,
        message: 'Navigation complete and element found',
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        url: t.String(),
        selector: t.String(),
        options: t.Optional(
          t.Object({
            timeout: t.Optional(t.Number()),
          })
        ),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Navigate and wait',
        description: 'Navigate to URL and wait for element to appear',
      },
    }
  )

  .post(
    '/session/:sessionId/fill-form',
    async ({ params: { sessionId }, body }) => {
      await browserController.fillAndSubmit(
        sessionId,
        body.fields,
        body.submitSelector
      );
      return {
        success: true,
        message: 'Form filled and submitted',
      };
    },
    {
      params: t.Object({
        sessionId: t.String(),
      }),
      body: t.Object({
        fields: t.Array(
          t.Object({
            selector: t.String(),
            value: t.String(),
          })
        ),
        submitSelector: t.String(),
      }),
      detail: {
        tags: ['Browser'],
        summary: 'Fill and submit form',
        description: 'Fill form fields and submit',
      },
    }
  );
