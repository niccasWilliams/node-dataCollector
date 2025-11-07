import type { Page } from "patchright";
import type { ShopAdapter, ScraperConfig } from "../price-scraper.service";
import type { ProductAvailability } from "@/db/individual/individual-schema";
import { logger } from "@/utils/logger";

/**
 * Amazon Adapter
 * Handles Amazon.de, Amazon.com, Amazon.co.uk, etc.
 */
export class AmazonAdapter implements ShopAdapter {
  name = "Amazon";
  domains = [
    "amazon.de",
    "amazon.com",
    "amazon.co.uk",
    "amazon.fr",
    "amazon.it",
    "amazon.es",
    "amazon.nl",
  ];

  canHandle(url: string): boolean {
    return url.includes("amazon.");
  }

  getConfig(url: string): ScraperConfig {
    return {
      // CSS Selectors (Amazon's selectors as of 2024)
      priceSelector: ".a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price-whole",
      originalPriceSelector: ".a-price.a-text-price .a-offscreen, #priceblock_saleprice",
      titleSelector: "#productTitle:not([type='hidden']), #title",
      availabilitySelector: "#availability span, #availability",
      brandSelector: "#bylineInfo, .a-spacing-none.po-brand .po-break-word",
      imageSelector: "#landingImage, #imgBlkFront",
      descriptionSelector: "#feature-bullets, #productDescription",

      waitForSelector: "#productTitle:not([type='hidden']), #title",

      // Custom extractors for Amazon-specific logic
      customExtractors: {
        asin: this.extractAsin,
        ean: this.extractEan,
        availability: this.extractAvailability,
        brand: this.extractBrand,
      },
    };
  }

  /**
   * Extract ASIN from Amazon URL or page
   */
  private async extractAsin(page: Page): Promise<string | null> {
    try {
      // Try to get from URL first (most reliable)
      const url = page.url();
      const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
      if (asinMatch) {
        return asinMatch[1];
      }

      // Try to get from page metadata
      const asinElement = await page.$('input[name="ASIN"]');
      if (asinElement) {
        const asin = await asinElement.getAttribute("value");
        if (asin) return asin;
      }

      // Try hidden field
      const hiddenAsin = await page.evaluate(() => {
        const input = document.querySelector<HTMLInputElement>('input[name="ASIN.0"]');
        return input?.value || null;
      });

      return hiddenAsin;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract EAN from Amazon product details
   */
  private async extractEan(page: Page): Promise<string | null> {
    try {
      // Look in product details table
      const ean = await page.evaluate(() => {
        // Try product details table first
        const rows = Array.from(document.querySelectorAll("tr.a-spacing-small, .prodDetTable tr, #productDetails_detailBullets_sections1 tr, #detailBullets_feature_div li"));
        for (const row of rows) {
          const text = row.textContent?.toLowerCase() || "";
          const label = row.querySelector("th, .label, .a-text-bold")?.textContent?.toLowerCase() || "";

          if (label.includes("ean") || label.includes("gtin") || text.includes("ean") || text.includes("gtin")) {
            // Try to find 13-digit number
            const match = text.match(/\b(\d{13})\b/);
            if (match) {
              return match[1];
            }

            // Also try value cell specifically
            const value = row.querySelector("td, .value, span:not(.a-text-bold)")?.textContent?.trim();
            if (value && /^\d{13}$/.test(value)) {
              return value;
            }
          }
        }

        // Try structured data (JSON-LD)
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent || "");
            if (data.gtin13) return data.gtin13;
            if (data.gtin) return data.gtin;
            if (data.ean) return data.ean;
          } catch {}
        }

        // Try product information section (sometimes in divs)
        const allDivs = Array.from(document.querySelectorAll('[id*="detail"], [class*="detail"], [id*="product"], [class*="product"]'));
        for (const div of allDivs) {
          const text = div.textContent?.toLowerCase() || "";
          if ((text.includes("ean") || text.includes("gtin")) && text.length < 500) { // Avoid huge sections
            const match = text.match(/\b(\d{13})\b/);
            if (match) {
              return match[1];
            }
          }
        }

        // Try meta tags
        const eanMeta = document.querySelector<HTMLMetaElement>('meta[property="product:ean"], meta[name="ean"]');
        if (eanMeta?.content && /^\d{13}$/.test(eanMeta.content)) {
          return eanMeta.content;
        }

        return null;
      });

      if (ean) {
        logger.debug(`[AmazonAdapter] EAN extracted: ${ean}`);
      } else {
        logger.debug('[AmazonAdapter] No EAN found');
      }

      return ean;
    } catch (error) {
      logger.error('[AmazonAdapter] EAN extraction error:', error);
      return null;
    }
  }

  /**
   * Extract availability with Amazon-specific logic
   */
  private async extractAvailability(page: Page): Promise<ProductAvailability> {
    try {
      const availabilityText = await page.evaluate(() => {
        const element = document.querySelector("#availability span, #availability");
        return element?.textContent?.toLowerCase().trim() || "";
      });

      // Amazon-specific availability patterns (German & English)
      if (
        availabilityText.includes("auf lager") ||
        availabilityText.includes("in stock") ||
        availabilityText.includes("verfügbar")
      ) {
        return "in_stock";
      }

      if (
        availabilityText.includes("derzeit nicht verfügbar") ||
        availabilityText.includes("currently unavailable") ||
        availabilityText.includes("out of stock")
      ) {
        return "out_of_stock";
      }

      if (
        availabilityText.includes("nur noch") ||
        availabilityText.includes("only") && availabilityText.includes("left")
      ) {
        return "limited_stock";
      }

      if (
        availabilityText.includes("vorbestell") ||
        availabilityText.includes("pre-order")
      ) {
        return "preorder";
      }

      // Check if "Add to Cart" button is disabled/missing
      const hasAddToCart = await page.evaluate(() => {
        const button = document.querySelector("#add-to-cart-button, #buy-now-button");
        return button !== null && !button.hasAttribute("disabled");
      });

      return hasAddToCart ? "in_stock" : "out_of_stock";
    } catch (error) {
      return "unknown";
    }
  }

  /**
   * Extract brand info and normalize Amazon-specific strings
   * Using single evaluate call to avoid wrapper issues
   */
  private async extractBrand(page: Page): Promise<string | null> {
    try {
      const result = await page.evaluate(() => {
        // Try standard selectors first
        const selectors = [
          "#bylineInfo",
          "a#bylineInfo",
          ".a-spacing-none.po-brand .po-break-word",
          "#brand",
          "tr.po-brand .po-break-word",
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element && element.textContent) {
            const text = element.textContent.replace(/\s+/g, " ").trim();

            // Remove Amazon-specific prefixes
            const visitMatch = text.match(/(?:Besuchen Sie den|Besuche den|Visit the)\s+(.+?)(?:-Store| Store)/i);
            if (visitMatch) {
              return visitMatch[1].trim();
            }

            // Remove "Brand:" prefix
            if (text.includes(":")) {
              const parts = text.split(":", 2);
              if (parts.length === 2 && parts[1].trim()) {
                return parts[1].trim();
              }
            }

            // Remove "von " or "by " prefix
            const byMatch = text.match(/^(?:von|by)\s+(.+)/i);
            if (byMatch) {
              return byMatch[1].trim();
            }

            // Use as-is if reasonable length
            if (text.length > 1 && text.length < 50 && !text.includes(".")) {
              return text;
            }
          }
        }

        // Fallback: Extract from title using known brands
        const titleElement = document.querySelector("#productTitle");
        if (titleElement && titleElement.textContent) {
          const title = titleElement.textContent.replace(/\s+/g, " ").trim();
          const titleLower = title.toLowerCase();

          const knownBrands = [
            'samsung', 'apple', 'lg', 'sony', 'philips', 'panasonic', 'toshiba', 'hisense', 'tcl',
            'dell', 'hp', 'lenovo', 'asus', 'acer', 'msi', 'microsoft', 'huawei', 'xiaomi',
            'bosch', 'siemens', 'miele', 'beko', 'whirlpool', 'aeg', 'bauknecht',
            'nike', 'adidas', 'puma', 'under armour',
            'logitech', 'razer', 'corsair', 'steelseries',
            'bose', 'jbl', 'harman kardon', 'sennheiser',
          ];

          // Try to match known brands
          for (const brand of knownBrands) {
            const brandRegex = new RegExp('\\b' + brand + '\\b', 'i');
            if (brandRegex.test(titleLower)) {
              // Return properly capitalized
              return brand
                .split(' ')
                .map(function(word) { return word.charAt(0).toUpperCase() + word.slice(1); })
                .join(' ');
            }
          }

          // Extract first word if it looks like a brand
          const firstWord = title.split(/\s+/)[0];
          if (firstWord && firstWord.length > 1 && firstWord.length < 20 && /^[A-Z]/.test(firstWord)) {
            const commonWords = ['the', 'for', 'with', 'new', 'original', 'premium', 'professional'];
            if (!commonWords.includes(firstWord.toLowerCase())) {
              return firstWord;
            }
          }
        }

        return null;
      });

      if (result) {
        logger.debug(`[AmazonAdapter] Brand extracted: ${result}`);
      } else {
        logger.debug('[AmazonAdapter] No brand found');
      }

      return result;
    } catch (error) {
      logger.error('[AmazonAdapter] Brand extraction error:', error);
      return null;
    }
  }
}
