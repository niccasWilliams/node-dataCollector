import type { Page } from "patchright";
import type { ShopAdapter, ScraperConfig } from "../price-scraper.service";
import type { ProductAvailability } from "@/db/individual/individual-schema";

/**
 * MediaMarkt Adapter
 * Handles MediaMarkt.de, MediaMarkt.at, MediaMarkt.ch, etc.
 */
export class MediaMarktAdapter implements ShopAdapter {
  name = "MediaMarkt";
  domains = [
    "mediamarkt.de",
    "mediamarkt.at",
    "mediamarkt.ch",
    "mediamarkt.nl",
    "mediamarkt.be",
  ];

  canHandle(url: string): boolean {
    return url.includes("mediamarkt.");
  }

  getConfig(url: string): ScraperConfig {
    return {
      // CSS Selectors (MediaMarkt's selectors as of 2024)
      priceSelector: [
        '[data-test="mms-product-price"]',
        '[data-test="mms-price-wrapper"] [itemprop="price"]',
        '.price [itemprop="price"]',
        '[itemprop="price"]',
        '.price'
      ].join(', '),
      originalPriceSelector: '[data-test="mms-crossed-price"], .strikethrough-price',
      titleSelector: 'h1[data-test="mms-product-title"], h1.product-title, h1',
      availabilitySelector: '[data-test="mms-delivery-info"], .availability, [data-test="mms-stock-info"]',
      brandSelector: '[data-test="mms-brand"], .brand-name',
      imageSelector: '[data-test="mms-gallery-main-image"] img, .product-image img',
      descriptionSelector: '[data-test="mms-product-description"], .product-description',

      waitForSelector: 'h1[data-test="mms-product-title"], h1',
      waitTime: 5000, // MediaMarkt uses React and cookie overlays - increased wait time

      // Custom extractors - bind context to preserve 'this'
      customExtractors: {
        ean: this.extractEan.bind(this),
        availability: this.extractAvailability.bind(this),
        price: this.extractPrice.bind(this),
        brand: this.extractBrand.bind(this),
        imageUrl: this.extractImageUrl.bind(this),
        description: this.extractDescription.bind(this),
        originalPrice: this.extractOriginalPrice.bind(this),
      },
    };
  }

  /**
   * Extract EAN from MediaMarkt product page
   */
  private async extractEan(page: Page): Promise<string | null> {
    try {
      // Look for EAN in product details
      const ean = await page.evaluate(() => {
        // Initialize __name helper (required by custom browser setup)
        if (typeof window !== "undefined" && typeof (window as any).__name !== "function") {
          (window as any).__name = function (target: any, value: string) {
            try {
              Object.defineProperty(target, "name", { value, configurable: true });
            } catch {
              // ignore
            }
            return target;
          };
        }
        if (typeof __name !== "function" && typeof window !== "undefined" && typeof (window as any).__name === "function") {
          var __name = (window as any).__name;
        }

        // Try structured data first (JSON-LD)
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent || "");
            if (data.gtin13) return data.gtin13;
            if (data.ean) return data.ean;
          } catch {}
        }

        // Try product details section
        const detailsElements = Array.from(document.querySelectorAll('[data-test*="product-detail"], .product-details li, .technical-data li'));
        for (const element of detailsElements) {
          const text = element.textContent?.toLowerCase() || "";
          if (text.includes("ean") || text.includes("gtin")) {
            const match = text.match(/(\d{13})/);
            if (match) return match[1];
          }
        }

        // Try meta tags
        const eanMeta = document.querySelector<HTMLMetaElement>('meta[property="product:ean"]');
        if (eanMeta?.content) return eanMeta.content;

        return null;
      });

      return ean;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract availability with MediaMarkt-specific logic
   */
  private async extractAvailability(page: Page): Promise<ProductAvailability> {
    try {
      // Wait for availability info to load
      await page.waitForTimeout(2000);

      const availabilityInfo = await page.evaluate(() => {
        // Initialize __name helper (required by custom browser setup)
        if (typeof window !== "undefined" && typeof (window as any).__name !== "function") {
          (window as any).__name = function (target: any, value: string) {
            try {
              Object.defineProperty(target, "name", { value, configurable: true });
            } catch {
              // ignore
            }
            return target;
          };
        }
        if (typeof __name !== "function" && typeof window !== "undefined" && typeof (window as any).__name === "function") {
          var __name = (window as any).__name;
        }

        // Debug: Log all availability-related elements
        console.log('=== MediaMarkt Availability Debug ===');
        const allAvailElements = document.querySelectorAll('[data-test*="delivery"], [data-test*="stock"], [class*="availability"], [class*="delivery"]');
        console.log('Found availability elements:', allAvailElements.length);
        allAvailElements.forEach((el, idx) => {
          const htmlEl = el as HTMLElement;
          console.log(`Element ${idx}:`, {
            tagName: htmlEl.tagName,
            className: htmlEl.className,
            dataTest: htmlEl.getAttribute('data-test'),
            textContent: htmlEl.textContent?.substring(0, 100),
          });
        });

        const deliveryInfo = document.querySelector('[data-test="mms-delivery-info"]')?.textContent?.toLowerCase() || "";
        const stockInfo = document.querySelector('[data-test="mms-stock-info"]')?.textContent?.toLowerCase() || "";
        const availability = document.querySelector('.availability')?.textContent?.toLowerCase() || "";

        // Also check all text that might indicate availability
        const bodyText = document.body.textContent?.toLowerCase() || "";

        console.log('Availability strings:', { deliveryInfo, stockInfo, availability });

        return (deliveryInfo + " " + stockInfo + " " + availability).trim();
      });

      // MediaMarkt-specific availability patterns (German)
      if (
        availabilityInfo.includes("sofort verfügbar") ||
        availabilityInfo.includes("sofort lieferbar") ||
        availabilityInfo.includes("auf lager") ||
        availabilityInfo.includes("versandbereit")
      ) {
        return "in_stock";
      }

      if (
        availabilityInfo.includes("nicht verfügbar") ||
        availabilityInfo.includes("ausverkauft") ||
        availabilityInfo.includes("nicht lieferbar")
      ) {
        return "out_of_stock";
      }

      if (
        availabilityInfo.includes("vorbestell") ||
        availabilityInfo.includes("demnächst verfügbar")
      ) {
        return "preorder";
      }

      if (
        availabilityInfo.includes("wenige") ||
        availabilityInfo.includes("begrenzte")
      ) {
        return "limited_stock";
      }

      if (
        availabilityInfo.includes("eingestellt") ||
        availabilityInfo.includes("nicht mehr erhältlich")
      ) {
        return "discontinued";
      }

      // Check if "Add to Cart" button is available
      const canAddToCart = await page.evaluate(() => {
        // Initialize __name helper (required by custom browser setup)
        if (typeof window !== "undefined" && typeof (window as any).__name !== "function") {
          (window as any).__name = function (target: any, value: string) {
            try {
              Object.defineProperty(target, "name", { value, configurable: true });
            } catch {
              // ignore
            }
            return target;
          };
        }
        if (typeof __name !== "function" && typeof window !== "undefined" && typeof (window as any).__name === "function") {
          var __name = (window as any).__name;
        }

        // Try multiple button selectors
        const buttonSelectors = [
          '[data-test="mms-add-to-cart"]',
          'button.add-to-cart',
          '[class*="AddToCart"]',
          '[data-test*="add-to-cart"]',
          'button[class*="add"]',
        ];

        for (const selector of buttonSelectors) {
          const button = document.querySelector(selector);
          if (button) {
            const isDisabled = button.hasAttribute('disabled') ||
                             button.getAttribute('aria-disabled') === 'true' ||
                             (button as HTMLButtonElement).disabled;
            console.log('Found add-to-cart button:', selector, 'disabled:', isDisabled);
            return !isDisabled;
          }
        }

        // Also check button text content
        const allButtons = Array.from(document.querySelectorAll('button'));
        for (const btn of allButtons) {
          const text = btn.textContent?.toLowerCase() || '';
          if (text.includes('warenkorb') || text.includes('cart') || text.includes('kaufen')) {
            const isDisabled = btn.hasAttribute('disabled') ||
                             btn.getAttribute('aria-disabled') === 'true' ||
                             btn.disabled;
            console.log('Found button by text:', text.substring(0, 30), 'disabled:', isDisabled);
            return !isDisabled;
          }
        }

        return false;
      });

      console.log('MediaMarkt availability decision:', {
        availabilityInfo,
        canAddToCart,
      });

      return canAddToCart ? "in_stock" : "out_of_stock";
    } catch (error) {
      return "unknown";
    }
  }

  /**
   * Extract price using MediaMarkt specific structure
   */
  private async extractPrice(page: Page): Promise<number | null> {
    console.log('==========================================');
    console.log('[MediaMarkt extractPrice] START');
    console.log('==========================================');

    try {
      console.log('[MediaMarkt] Waiting 4 seconds for price to load...');
      await page.waitForTimeout(4000);

      // Extract price directly from page using evaluate
      const priceData = await page.evaluate((): { price: string | null; debug: string[] } => {
        // Initialize __name helper (required by custom browser setup)
        if (typeof window !== "undefined" && typeof (window as any).__name !== "function") {
          (window as any).__name = function (target: any, value: string) {
            try {
              Object.defineProperty(target, "name", { value, configurable: true });
            } catch {
              // ignore
            }
            return target;
          };
        }
        if (typeof __name !== "function" && typeof window !== "undefined" && typeof (window as any).__name === "function") {
          var __name = (window as any).__name;
        }

        const debug: string[] = [];
        function sanitize(value: string | null | undefined): string | null {
          if (!value) return null;
          return value.replace(/\s+/g, ' ').trim();
        }

        // Debug: Collect all elements that might contain price
        debug.push('=== MediaMarkt Price Debug ===');
        const allPriceElements = document.querySelectorAll('[data-test*="price"], [class*="price"], [itemprop="price"], [class*="Price"]');
        debug.push(`Found ${allPriceElements.length} price elements`);
        allPriceElements.forEach((el, idx) => {
          const htmlEl = el as HTMLElement;
          debug.push(`Element ${idx}: ${htmlEl.tagName} class="${htmlEl.className}" data-test="${htmlEl.getAttribute('data-test')}" text="${htmlEl.textContent?.substring(0, 50)}"`);
        });

        function parseJsonLd(): string | null {
          const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>('script[type="application/ld+json"]'));
          for (const script of scripts) {
            try {
              const content = script.textContent;
              if (!content) continue;
              const data = JSON.parse(content);
              const candidates = Array.isArray(data) ? data : [data];
              for (const entry of candidates) {
                if (entry && typeof entry === 'object') {
                  const offers = (entry as any).offers || (entry as any).Offers;
                  if (offers) {
                    const offerList = Array.isArray(offers) ? offers : [offers];
                    for (const offer of offerList) {
                      if (offer && typeof offer === 'object' && (offer as any).price) {
                        return String((offer as any).price);
                      }
                      if (offer && typeof offer === 'object' && (offer as any).priceSpecification) {
                        const spec = Array.isArray((offer as any).priceSpecification)
                          ? (offer as any).priceSpecification
                          : [(offer as any).priceSpecification];
                        for (const item of spec) {
                          if (item && typeof item === 'object' && (item as any).price) {
                            return String((item as any).price);
                          }
                        }
                      }
                    }
                  }
                }
              }
            } catch {
              // ignore malformed JSON
            }
          }
          return null;
        }

        function parseInlinePrice(): { price: string | null; debug: string[] } {
          // Try MediaMarkt-specific branded price first (from user's HTML analysis)
          const wholeValue = document.querySelector('[data-test="branded-price-whole-value"]');
          const decimalValue = document.querySelector('[data-test="branded-price-decimal-value"]');

          if (wholeValue && decimalValue) {
            const whole = wholeValue.textContent?.trim().replace(',', '') || '';
            const decimal = decimalValue.textContent?.trim() || '';
            if (whole && decimal) {
              const priceStr = `${whole}.${decimal}`;
              debug.push(`✓ Found price from branded-price selectors: ${priceStr}`);
              return { price: priceStr, debug };
            }
          }

          // Try screen-reader price element
          const screenReaderPrice = document.querySelector('.sc-e0c7d9f7-0.bPkjPs');
          if (screenReaderPrice) {
            const text = screenReaderPrice.textContent?.trim();
            if (text && /\d/.test(text)) {
              debug.push(`✓ Found price from screen-reader element: ${text}`);
              return { price: text, debug };
            }
          }

          // Fallback to generic selectors
          const selectors = [
            '[data-test="cofr-price"] [data-test*="branded-price"]',
            '[data-test="mms-branded-price"]',
            '[data-test="mms-product-price"] [itemprop="price"]',
            '[data-test="mms-product-price"]',
            '[data-test="mms-price-wrapper"] [itemprop="price"]',
            '[data-test="mms-price-wrapper"]',
            '[data-test="product-price"]',
            '[itemprop="price"]',
            '.price [itemprop="price"]',
            '.price',
            '[class*="Price"]', // Capital P for React components
            '[class*="price"]',
            '[data-price]',
            'span[class*="StyledPrice"]',
            '[class*="ProductPrice"]',
          ];

          for (const selector of selectors) {
            try {
              const nodes = document.querySelectorAll<HTMLElement>(selector);
              for (const priceNode of Array.from(nodes)) {
                if (!priceNode) continue;

                // Try attributes first
                const attr = priceNode.getAttribute('content') ||
                            priceNode.getAttribute('data-price') ||
                            priceNode.getAttribute('data-value');
                if (attr && /\d/.test(attr)) {
                  debug.push(`✓ Found price in attribute: "${attr}" from selector: ${selector}`);
                  return { price: attr, debug };
                }

                // Try text content
                const text = sanitize(priceNode.textContent);
                if (text && /\d+[,.]?\d*\s*€?/.test(text)) {
                  // Make sure it looks like a price (has digits and possibly € symbol)
                  debug.push(`✓ Found price in text: "${text}" from selector: ${selector}`);
                  return { price: text, debug };
                }
              }
            } catch (e) {
              // Ignore selector errors
            }
          }

          // Last resort: Search for anything that looks like a price in the whole page
          debug.push('Trying last resort price search...');
          const allText = document.body.textContent || '';

          // Try multiple price patterns
          const patterns = [
            /(\d{1,4})[,.](\d{2})\s*€/g,           // 599,99 € or 599.99 €
            /€\s*(\d{1,4})[,.](\d{2})/g,           // € 599,99
            /(\d{1,4})\s*€/g,                      // 599 €
            /(\d{1,4})[,.](\d{2})/g,               // 599,99 (no € symbol)
          ];

          for (const pattern of patterns) {
            const matches = Array.from(allText.matchAll(pattern));
            if (matches.length > 0) {
              debug.push(`Pattern matched ${matches.length} times`);

              for (const match of matches) {
                let priceStr: string;
                if (match.length === 3 && match[2]) {
                  // Has decimals: 599,99
                  priceStr = `${match[1]}.${match[2]}`;
                } else {
                  priceStr = match[1];
                }

                const val = parseFloat(priceStr);
                if (val >= 100 && val < 100000) { // TVs cost at least 100 EUR
                  debug.push(`✓ Found valid price: ${val} EUR from "${match[0]}"`);
                  return { price: `${val}`, debug };
                }
              }
            }
          }

          debug.push('No valid prices found in any pattern');

          debug.push('✗ No price found');
          return { price: null, debug };
        }

        function fromMeta(): string | null {
          const meta = document.querySelector<HTMLMetaElement>('meta[itemprop="price"]');
          if (meta?.content) {
            debug.push(`✓ Found price in meta: ${meta.content}`);
            return meta.content;
          }
          return null;
        }

        // Try all methods in order
        const inlineResult = parseInlinePrice();
        if (inlineResult && inlineResult.price) {
          return inlineResult;
        }

        debug.push('Inline price not found, trying JSON-LD...');
        const jsonLdPrice = parseJsonLd();
        if (jsonLdPrice) {
          debug.push(`✓ Found price in JSON-LD: ${jsonLdPrice}`);
          return { price: jsonLdPrice, debug };
        }

        debug.push('JSON-LD not found, trying meta...');
        const metaPrice = fromMeta();
        if (metaPrice) {
          return { price: metaPrice, debug };
        }

        return { price: null, debug };
      });

      // Log debug info
      console.log('=================================================');
      console.log('[MediaMarkt Price Debug]');
      console.log('=================================================');
      priceData.debug.forEach(line => console.log(line));
      console.log('=================================================');

      if (!priceData.price) {
        console.log('[MediaMarkt] ❌ No price found via page.evaluate()');
        console.log('==========================================');
        return null;
      }

      console.log('[MediaMarkt] ✓ Found price string:', priceData.price);

      // Parse the price string
      const sanitize = (value: string | null | undefined): string | null => {
        if (!value) return null;
        return value.replace(/\s+/g, ' ').trim();
      };

      const priceString = sanitize(priceData.price);
      if (!priceString) {
        console.log('[MediaMarkt] ❌ Price string is empty after sanitization');
        console.log('==========================================');
        return null;
      }

      // Remove all non-numeric characters except comma, dot, and minus
      const cleaned = priceString
        .replace(/[^\d,.-]/g, '')
        .trim();

      if (!cleaned) {
        console.log('[MediaMarkt] ❌ Cleaned price string is empty');
        console.log('==========================================');
        return null;
      }

      // Normalize price format (handle both German and English formats)
      const normalized = cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? cleaned.replace(/\./g, '').replace(',', '.')  // German format: 1.299,99 -> 1299.99
        : cleaned.replace(/,/g, '');                      // English format: 1,299.99 -> 1299.99

      const value = Number(normalized);

      if (!Number.isFinite(value)) {
        console.log('[MediaMarkt] ❌ Could not parse price as number:', normalized);
        console.log('==========================================');
        return null;
      }

      console.log('[MediaMarkt] ✅ SUCCESS! Final price:', value);
      console.log('==========================================');
      return value;
    } catch (error) {
      console.error('[MediaMarkt] ❌ ERROR in extractPrice:', error);
      console.log('==========================================');
      return null;
    }
  }

  /**
   * Extract brand from MediaMarkt product page
   * Falls back to extracting brand from product title
   */
  private async extractBrand(page: Page): Promise<string | null> {
    try {
      // First try the brand selector
      const brandFromSelector = await page.evaluate(() => {
        // Initialize __name helper (required by custom browser setup)
        if (typeof window !== "undefined" && typeof (window as any).__name !== "function") {
          (window as any).__name = function (target: any, value: string) {
            try {
              Object.defineProperty(target, "name", { value, configurable: true });
            } catch {
              // ignore
            }
            return target;
          };
        }
        if (typeof __name !== "function" && typeof window !== "undefined" && typeof (window as any).__name === "function") {
          var __name = (window as any).__name;
        }

        const brandElement = document.querySelector('[data-test="mms-brand"], .brand-name');
        if (brandElement?.textContent) {
          return brandElement.textContent.trim();
        }
        return null;
      });

      if (brandFromSelector) {
        return brandFromSelector;
      }

      // Fallback: Extract from product title
      const title = await page.evaluate(() => {
        const titleElement = document.querySelector('h1[data-test="mms-product-title"], h1.product-title, h1');
        return titleElement?.textContent?.trim() || null;
      });

      if (!title) {
        return null;
      }

      // Extract brand from title (first word is usually the brand)
      const commonBrands = [
        'samsung', 'apple', 'lg', 'sony', 'philips', 'panasonic', 'bosch', 'siemens',
        'miele', 'beko', 'whirlpool', 'dell', 'hp', 'lenovo', 'asus', 'acer', 'msi',
      ];

      const titleLower = title.toLowerCase();
      for (const brand of commonBrands) {
        if (titleLower.startsWith(brand) || titleLower.includes(` ${brand} `)) {
          // Return with proper capitalization
          return brand.charAt(0).toUpperCase() + brand.slice(1);
        }
      }

      // If no known brand found, take first word as brand
      const firstWord = title.split(/\s+/)[0];
      if (firstWord && firstWord.length > 2) {
        return firstWord;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract image URL from MediaMarkt product page
   */
  private async extractImageUrl(page: Page): Promise<string | null> {
    try {
      const imageUrl = await page.evaluate(() => {
        // Initialize __name helper (required by custom browser setup)
        if (typeof window !== "undefined" && typeof (window as any).__name !== "function") {
          (window as any).__name = function (target: any, value: string) {
            try {
              Object.defineProperty(target, "name", { value, configurable: true });
            } catch {
              // ignore
            }
            return target;
          };
        }
        if (typeof __name !== "function" && typeof window !== "undefined" && typeof (window as any).__name === "function") {
          var __name = (window as any).__name;
        }

        // Try multiple image selectors
        const selectors = [
          '[data-test="mms-gallery-main-image"] img',
          '[data-test="mms-product-image"] img',
          '.product-image img',
          '.gallery-image img',
          '[class*="ProductImage"] img',
          '[class*="Gallery"] img[src*="mediamarkt"]',
          'img[itemprop="image"]',
        ];

        for (const selector of selectors) {
          const img = document.querySelector<HTMLImageElement>(selector);
          if (img?.src && img.src.startsWith('http')) {
            // Prefer larger images if available
            const srcset = img.getAttribute('srcset');
            if (srcset) {
              const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
              // Return the last (usually largest) image
              if (urls.length > 0) {
                return urls[urls.length - 1];
              }
            }
            return img.src;
          }
        }

        // Try structured data
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent || "");
            if (data.image) {
              if (typeof data.image === 'string') return data.image;
              if (Array.isArray(data.image) && data.image.length > 0) return data.image[0];
              if (data.image.url) return data.image.url;
            }
          } catch {}
        }

        // Try Open Graph image
        const ogImage = document.querySelector<HTMLMetaElement>('meta[property="og:image"]');
        if (ogImage?.content) return ogImage.content;

        return null;
      });

      return imageUrl;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract description from MediaMarkt product page
   */
  private async extractDescription(page: Page): Promise<string | null> {
    try {
      const description = await page.evaluate(() => {
        // Initialize __name helper (required by custom browser setup)
        if (typeof window !== "undefined" && typeof (window as any).__name !== "function") {
          (window as any).__name = function (target: any, value: string) {
            try {
              Object.defineProperty(target, "name", { value, configurable: true });
            } catch {
              // ignore
            }
            return target;
          };
        }
        if (typeof __name !== "function" && typeof window !== "undefined" && typeof (window as any).__name === "function") {
          var __name = (window as any).__name;
        }

        // Try multiple description selectors
        const selectors = [
          '[data-test="mms-product-description"]',
          '.product-description',
          '[class*="ProductDescription"]',
          '[data-test*="description"]',
          '[itemprop="description"]',
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element?.textContent) {
            const text = element.textContent.trim();
            if (text.length > 20) { // Ensure it's a meaningful description
              return text;
            }
          }
        }

        // Try structured data
        const scripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
        for (const script of scripts) {
          try {
            const data = JSON.parse(script.textContent || "");
            if (data.description && typeof data.description === 'string' && data.description.length > 20) {
              return data.description;
            }
          } catch {}
        }

        // Try meta description
        const metaDesc = document.querySelector<HTMLMetaElement>('meta[name="description"]');
        if (metaDesc?.content && metaDesc.content.length > 20) {
          return metaDesc.content;
        }

        return null;
      });

      return description;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract original price (crossed-out price) from MediaMarkt product page
   */
  private async extractOriginalPrice(page: Page): Promise<number | null> {
    try {
      const originalPriceString = await page.evaluate(() => {
        // Initialize __name helper (required by custom browser setup)
        if (typeof window !== "undefined" && typeof (window as any).__name !== "function") {
          (window as any).__name = function (target: any, value: string) {
            try {
              Object.defineProperty(target, "name", { value, configurable: true });
            } catch {
              // ignore
            }
            return target;
          };
        }
        if (typeof __name !== "function" && typeof window !== "undefined" && typeof (window as any).__name === "function") {
          var __name = (window as any).__name;
        }

        // Try multiple original price selectors
        const selectors = [
          '[data-test="mms-crossed-price"]',
          '.strikethrough-price',
          '.original-price',
          '[data-test*="original-price"]',
          '[class*="CrossedPrice"]',
          '[class*="OriginalPrice"]',
          'span[style*="text-decoration: line-through"]',
          'span[style*="text-decoration:line-through"]',
        ];

        for (const selector of selectors) {
          const element = document.querySelector(selector);
          if (element?.textContent) {
            const text = element.textContent.trim();
            // Check if it looks like a price
            if (/\d+[,.]?\d*\s*€?/.test(text)) {
              return text;
            }
          }
        }

        // Try to find any struck-through price elements
        const allElements = Array.from(document.querySelectorAll('*'));
        for (const element of allElements) {
          const htmlEl = element as HTMLElement;
          const style = window.getComputedStyle(htmlEl);
          if (style.textDecoration.includes('line-through')) {
            const text = htmlEl.textContent?.trim() || '';
            if (/\d+[,.]?\d*\s*€/.test(text) && text.length < 20) {
              return text;
            }
          }
        }

        return null;
      });

      if (!originalPriceString) return null;

      // Parse the price string (same logic as extractPrice)
      const cleaned = originalPriceString
        .replace(/[^\d,.-]/g, '')
        .trim();

      if (!cleaned) return null;

      // Normalize price format
      const normalized = cleaned.includes(',') && cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? cleaned.replace(/\./g, '').replace(',', '.')  // German format: 1.299,99 -> 1299.99
        : cleaned.replace(/,/g, '');                      // English format: 1,299.99 -> 1299.99

      const value = Number(normalized);

      return Number.isFinite(value) ? value : null;
    } catch (error) {
      return null;
    }
  }
}
