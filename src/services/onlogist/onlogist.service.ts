/**
 * Onlogist Service
 * Handles automation for Onlogist.com platform
 * - Login/Logout
 * - Search with filters
 * - Order extraction
 */

import { logger } from "@/utils/logger";
import { browserHandler } from "@/services/browser/browser.handler";
import type {
  OnlogistCredentials,
  OnlogistSearchFilters,
  OnlogistOrder,
  OnlogistScrapeResult,
  OnlogistSessionState,
} from "./onlogist.types";

export class OnlogistService {
  private static readonly BASE_URL = "https://portal.onlogist.com";
  private static readonly LOGIN_URL = `${OnlogistService.BASE_URL}/secure/login`;
  private static readonly ORDERS_URL = `${OnlogistService.BASE_URL}/orders?__clear=true`;
  private static readonly MY_OFFERS_URL = `${OnlogistService.BASE_URL}/#myPriceOffers`;

  /**
   * Create a new browser session and login to Onlogist
   */
  async login(credentials: OnlogistCredentials): Promise<OnlogistSessionState> {
    logger.info(`[Onlogist] Starting login for user: ${credentials.username}`);

    // Create browser session (humanized interactions are now default!)
    const session = await browserHandler.createSession({
      headless: false, // Keep visible for debugging
    });

    const sessionId = session.id.toString();

    try {
      // Navigate to login page
      await browserHandler.navigate(sessionId, OnlogistService.LOGIN_URL);
      logger.debug(`[Onlogist] Navigated to login page`);

      // Wait for login form to load
      await browserHandler.waitForSelector(sessionId, 'input[type="text"], input[name="username"], input#username', {
        timeout: 10000,
      });

      // Find and fill username field
      const usernameField = await this.findLoginField(sessionId, "username");
      if (!usernameField) {
        throw new Error("Could not find username field on login page");
      }

      await browserHandler.type(sessionId, usernameField, credentials.username);

      logger.debug(`[Onlogist] Entered username`);

      // Find and fill password field
      const passwordField = await this.findLoginField(sessionId, "password");
      if (!passwordField) {
        throw new Error("Could not find password field on login page");
      }

      await browserHandler.type(sessionId, passwordField, credentials.password);

      logger.debug(`[Onlogist] Entered password`);

      // Find and click login button
      const loginButton = await this.findLoginButton(sessionId);
      if (!loginButton) {
        throw new Error("Could not find login button");
      }

      await browserHandler.click(sessionId, loginButton);

      logger.debug(`[Onlogist] Clicked login button`);

      // Wait for navigation after login (either to orders page or my offers)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Check if login was successful
      const currentUrl = (await browserHandler.getPageInfo(sessionId)).url;
      const isLoggedIn = !currentUrl.includes("/login");

      if (!isLoggedIn) {
        // Check for error messages
        const errorMessage = await this.extractLoginError(sessionId);
        throw new Error(`Login failed: ${errorMessage || "Unknown error"}`);
      }

      logger.info(`[Onlogist] ✅ Login successful for ${credentials.username}`);

      return {
        sessionId,
        isLoggedIn: true,
        lastActivity: new Date(),
        username: credentials.username,
      };
    } catch (error) {
      // Close session on error
      await browserHandler.closeSession(sessionId).catch(() => {});
      throw error;
    }
  }

  /**
   * Logout from Onlogist and close session
   */
  async logout(sessionId: string): Promise<void> {
    logger.info(`[Onlogist] Logging out session: ${sessionId}`);

    try {
      // Try to find and click logout button
      const logoutSuccess = await browserHandler.logout(sessionId, {
        keywords: ["logout", "abmelden", "ausloggen"],
        waitForNavigation: true,
        timeout: 5000,
      });

      if (logoutSuccess) {
        logger.info(`[Onlogist] ✅ Logout successful`);
      } else {
        logger.warn(`[Onlogist] ⚠️ Could not find logout button, closing session anyway`);
      }
    } catch (error) {
      logger.error(`[Onlogist] Logout error:`, error);
    } finally {
      // Always close the browser session
      await browserHandler.closeSession(sessionId);
      logger.debug(`[Onlogist] Session closed`);
    }
  }

  /**
   * Search for orders with filters
   */
  async searchOrders(
    sessionId: string,
    filters: OnlogistSearchFilters
  ): Promise<OnlogistScrapeResult> {
    logger.info(`[Onlogist] Searching orders with filters:`, filters);

    try {
      // Navigate to orders page
      await browserHandler.navigate(sessionId, OnlogistService.ORDERS_URL);
      logger.debug(`[Onlogist] Navigated to orders page`);

      // Wait for page to load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Apply filters
      await this.applySearchFilters(sessionId, filters);

      // Wait for results to load
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Extract orders from page
      const orders = await this.extractOrders(sessionId);

      logger.info(`[Onlogist] ✅ Found ${orders.length} orders`);

      return {
        success: true,
        orders,
        filters,
        totalFound: orders.length,
        scrapedAt: new Date(),
        sessionId,
      };
    } catch (error) {
      logger.error(`[Onlogist] Search error:`, error);
      return {
        success: false,
        orders: [],
        filters,
        totalFound: 0,
        scrapedAt: new Date(),
        sessionId,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Apply search filters on orders page
   */
  private async applySearchFilters(
    sessionId: string,
    filters: OnlogistSearchFilters
  ): Promise<void> {
    logger.debug(`[Onlogist] Applying search filters...`);

    // Set radius (Umkreis)
    if (filters.umkreis) {
      const umkreisSelector = 'select[name="umkreis"], #umkreis';
      try {
        await browserHandler.select(sessionId, umkreisSelector, filters.umkreis.toString());
        logger.debug(`[Onlogist] Set Umkreis: ${filters.umkreis}km`);
      } catch (error) {
        logger.warn(`[Onlogist] Could not set Umkreis filter:`, error);
      }
    }

    // Set starting location (Startort)
    if (filters.startort) {
      const startortSelector = 'input[name="startort"], #startort';
      try {
        await browserHandler.type(sessionId, startortSelector, filters.startort);
        logger.debug(`[Onlogist] Set Startort: ${filters.startort}`);
      } catch (error) {
        logger.warn(`[Onlogist] Could not set Startort filter:`, error);
      }
    }

    // Set destination (Zielort)
    if (filters.zielort) {
      const zielortSelector = 'input[name="zielort"], #zielort';
      try {
        await browserHandler.type(sessionId, zielortSelector, filters.zielort);
        logger.debug(`[Onlogist] Set Zielort: ${filters.zielort}`);
      } catch (error) {
        logger.warn(`[Onlogist] Could not set Zielort filter:`, error);
      }
    }

    // Set date range (von/bis)
    if (filters.von) {
      const vonSelector = 'input[name="von"], #von';
      try {
        const dateStr = filters.von.toISOString().split("T")[0]; // YYYY-MM-DD
        await browserHandler.type(sessionId, vonSelector, dateStr);
        logger.debug(`[Onlogist] Set Von date: ${dateStr}`);
      } catch (error) {
        logger.warn(`[Onlogist] Could not set Von date:`, error);
      }
    }

    if (filters.bis) {
      const bisSelector = 'input[name="bis"], #bis';
      try {
        const dateStr = filters.bis.toISOString().split("T")[0]; // YYYY-MM-DD
        await browserHandler.type(sessionId, bisSelector, dateStr);
        logger.debug(`[Onlogist] Set Bis date: ${dateStr}`);
      } catch (error) {
        logger.warn(`[Onlogist] Could not set Bis date:`, error);
      }
    }

    // Set distance filter (Entfernung)
    if (filters.entfernung !== undefined) {
      const entfernungSelector = 'select[name="entfernung"], #entfernung';
      try {
        await browserHandler.select(sessionId, entfernungSelector, filters.entfernung.toString());
        logger.debug(`[Onlogist] Set Entfernung: ${filters.entfernung}`);
      } catch (error) {
        logger.warn(`[Onlogist] Could not set Entfernung filter:`, error);
      }
    }

    // Set qualification filter
    if (filters.qualifikation) {
      const qualifikationSelector = 'select[name="qualifikation"], #qualifikation';
      try {
        await browserHandler.select(sessionId, qualifikationSelector, filters.qualifikation);
        logger.debug(`[Onlogist] Set Qualifikation: ${filters.qualifikation}`);
      } catch (error) {
        logger.warn(`[Onlogist] Could not set Qualifikation filter:`, error);
      }
    }

    // Show expired orders checkbox
    if (filters.ausgeblendeteAuftraegeAnzeigen) {
      const checkboxSelector = 'input[type="checkbox"][name="ausgeblendet"], #ausgeblendet';
      try {
        await browserHandler.click(sessionId, checkboxSelector);
        logger.debug(`[Onlogist] Enabled "Ausgeblendete Aufträge anzeigen"`);
      } catch (error) {
        logger.warn(`[Onlogist] Could not toggle expired orders checkbox:`, error);
      }
    }

    // Click "Finden" (Search) button
    const findenButtonSelector = 'button[type="submit"], button.btn-search, input[type="submit"]';
    try {
      await browserHandler.click(sessionId, findenButtonSelector);
      logger.debug(`[Onlogist] Clicked search button`);
    } catch (error) {
      logger.warn(`[Onlogist] Could not click search button:`, error);
    }
  }

  /**
   * Extract orders from the current page
   */
  private async extractOrders(sessionId: string): Promise<OnlogistOrder[]> {
    logger.debug(`[Onlogist] Extracting orders from page...`);

    // Extract orders using page evaluation
    const orders = await browserHandler.evaluate<OnlogistOrder[]>(
      sessionId,
      () => {
        const orders: any[] = [];

        // Based on the screenshot, orders are in a table
        // We need to find the table rows with order data
        const orderRows = document.querySelectorAll("table tbody tr");

        orderRows.forEach((row) => {
          try {
            const cells = row.querySelectorAll("td");
            if (cells.length < 5) return; // Not a valid order row

            // Extract data from cells (adjust based on actual HTML structure)
            const fahrtNr = cells[0]?.textContent?.trim() || "";
            const abholzeit = cells[1]?.textContent?.trim() || "";
            const ankunftszeit = cells[2]?.textContent?.trim() || "";
            const startort = cells[3]?.textContent?.trim() || "";
            const zielort = cells[4]?.textContent?.trim() || "";
            const entfernung = cells[5]?.textContent?.trim() || "";
            const auftraggeber = cells[6]?.textContent?.trim() || "";

            // Parse values
            const entfernungNum = parseInt(entfernung.replace(/\D/g, "")) || 0;

            const order = {
              id: fahrtNr,
              fahrtNr,
              abholzeit: new Date(abholzeit),
              ankunftszeit: ankunftszeit ? new Date(ankunftszeit) : undefined,
              startort,
              zielort,
              entfernung: entfernungNum,
              auftraggeber,
              scrapedAt: new Date(),
            };

            if (fahrtNr && startort && zielort) {
              orders.push(order);
            }
          } catch (error) {
            console.error("Error parsing order row:", error);
          }
        });

        return orders;
      }
    );

    return orders;
  }

  /**
   * Helper: Find username/email field on login page
   */
  private async findLoginField(
    sessionId: string,
    type: "username" | "password"
  ): Promise<string | null> {
    const selectors =
      type === "username"
        ? [
            'input[name="username"]',
            'input[name="email"]',
            'input[type="text"]',
            'input[type="email"]',
            "#username",
            "#email",
            'input[placeholder*="Benutzername" i]',
            'input[placeholder*="E-Mail" i]',
          ]
        : [
            'input[name="password"]',
            'input[type="password"]',
            "#password",
            'input[placeholder*="Passwort" i]',
          ];

    for (const selector of selectors) {
      try {
        const exists = await browserHandler.evaluate<boolean>(
          sessionId,
          (sel: string) => document.querySelector(sel) !== null,
          selector
        );
        if (exists) {
          return selector;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Helper: Find login button
   */
  private async findLoginButton(sessionId: string): Promise<string | null> {
    const selectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button[name="login"]',
      'button:has-text("Login")',
      'button:has-text("Anmelden")',
      ".btn-login",
      ".login-button",
    ];

    for (const selector of selectors) {
      try {
        const exists = await browserHandler.evaluate<boolean>(
          sessionId,
          (sel: string) => document.querySelector(sel) !== null,
          selector
        );
        if (exists) {
          return selector;
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  /**
   * Helper: Extract login error message
   */
  private async extractLoginError(sessionId: string): Promise<string | null> {
    try {
      return await browserHandler.evaluate<string | null>(sessionId, () => {
        const errorSelectors = [
          ".error-message",
          ".alert-danger",
          ".login-error",
          '[role="alert"]',
          ".alert",
        ];

        for (const selector of errorSelectors) {
          const element = document.querySelector(selector);
          if (element?.textContent) {
            return element.textContent.trim();
          }
        }

        return null;
      });
    } catch {
      return null;
    }
  }
}

// Export singleton instance
export const onlogistService = new OnlogistService();
