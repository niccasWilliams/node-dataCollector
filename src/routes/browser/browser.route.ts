import express from 'express';
import { browserController } from '../../services/browser';
import path from 'path';
import fs from 'fs/promises';

const router = express.Router();

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

// ========== Session Management ==========

/**
 * POST /browser/session
 * Create new browser session
 */
router.post('/session', async (req, res) => {
  try {
    const { config } = req.body;
    const session = await browserController.createSession(config || {});
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
});

/**
 * GET /browser/session/:sessionId
 * Get session info
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = browserController.getSession(sessionId);
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
});

/**
 * GET /browser/sessions
 * Get all active sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    const sessions = browserController.getAllSessions();
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
});

/**
 * DELETE /browser/session/:sessionId
 * Close browser session
 */
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await browserController.closeSession(sessionId);
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
});

// ========== Navigation ==========

/**
 * POST /browser/session/:sessionId/navigate
 * Navigate to URL
 */
router.post('/session/:sessionId/navigate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { url, options } = req.body;
    await browserController.navigate(sessionId, url, options);
    const session = browserController.getSession(sessionId);
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
});

/**
 * POST /browser/session/:sessionId/back
 * Go back in history
 */
router.post('/session/:sessionId/back', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await browserController.goBack(sessionId);
    const session = browserController.getSession(sessionId);
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
});

/**
 * POST /browser/session/:sessionId/forward
 * Go forward in history
 */
router.post('/session/:sessionId/forward', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await browserController.goForward(sessionId);
    const session = browserController.getSession(sessionId);
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
});

/**
 * POST /browser/session/:sessionId/reload
 * Reload current page
 */
router.post('/session/:sessionId/reload', async (req, res) => {
  try {
    const { sessionId } = req.params;
    await browserController.reload(sessionId);
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
});

// ========== Screenshots ==========

/**
 * POST /browser/session/:sessionId/screenshot
 * Take screenshot
 */
router.post('/session/:sessionId/screenshot', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { fullPage, type, quality } = req.body;

    const screenshotDir = path.join(process.cwd(), 'storage', 'screenshots');
    await fs.mkdir(screenshotDir, { recursive: true });

    const timestamp = Date.now();
    const filename = `screenshot-${sessionId}-${timestamp}.${type || 'png'}`;
    const filepath = path.join(screenshotDir, filename);

    const screenshot = await browserController.screenshot(sessionId, {
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
});

/**
 * GET /browser/screenshots/:filename
 * Get screenshot file
 */
router.get('/screenshots/:filename', async (req, res) => {
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
});

// ========== Page Interaction ==========

/**
 * POST /browser/session/:sessionId/click
 * Click element
 */
router.post('/session/:sessionId/click', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { selector } = req.body;
    await browserController.click(sessionId, selector);
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
});

/**
 * POST /browser/session/:sessionId/type
 * Type into input field
 */
router.post('/session/:sessionId/type', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { selector, text } = req.body;
    await browserController.type(sessionId, selector, text);
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
});

/**
 * POST /browser/session/:sessionId/select
 * Select option from dropdown
 */
router.post('/session/:sessionId/select', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { selector, value } = req.body;
    await browserController.select(sessionId, selector, value);
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
});

/**
 * POST /browser/session/:sessionId/hover
 * Hover over element
 */
router.post('/session/:sessionId/hover', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { selector } = req.body;
    await browserController.hover(sessionId, selector);
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
});

/**
 * POST /browser/session/:sessionId/scroll
 * Scroll page
 */
router.post('/session/:sessionId/scroll', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { x, y } = req.body;
    await browserController.scroll(sessionId, x || 0, y || 0);
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
});

/**
 * POST /browser/session/:sessionId/wait
 * Wait for element
 */
router.post('/session/:sessionId/wait', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { selector, options } = req.body;
    await browserController.waitForSelector(sessionId, selector, options);
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
});

// ========== Page Info & Data ==========

/**
 * GET /browser/session/:sessionId/info
 * Get page info
 */
router.get('/session/:sessionId/info', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const info = await browserController.getPageInfo(sessionId);
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
});

/**
 * GET /browser/session/:sessionId/html
 * Get page HTML
 */
router.get('/session/:sessionId/html', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const html = await browserController.getHTML(sessionId);
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
});

/**
 * POST /browser/session/:sessionId/evaluate
 * Execute JavaScript in page context
 */
router.post('/session/:sessionId/evaluate', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { script } = req.body;

    // Create function from string if needed
    const evalFunction = new Function(`return ${script}`)();
    const result = await browserController.evaluate(sessionId, evalFunction);

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
});

// ========== Helper Routes ==========

/**
 * POST /browser/session/:sessionId/navigate-and-wait
 * Navigate and wait for element
 */
router.post('/session/:sessionId/navigate-and-wait', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { url, selector, options } = req.body;
    await browserController.navigateAndWait(sessionId, url, selector, options);
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
});

/**
 * POST /browser/session/:sessionId/fill-form
 * Fill and submit form
 */
router.post('/session/:sessionId/fill-form', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { fields, submitSelector } = req.body;
    await browserController.fillAndSubmit(sessionId, fields, submitSelector);
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
});

export default router;
