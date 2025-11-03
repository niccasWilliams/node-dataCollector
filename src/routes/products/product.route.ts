import { Router } from "express";
import { productController } from "./product.controller";

const router = Router();

/**
 * @openapi
 * tags:
 *   - name: Products
 *     description: Manage products, prices, and price alerts for your price tracking system
 */

/**
 * @openapi
 * /products:
 *   get:
 *     summary: List all products
 *     description: Get a paginated list of all products with their sources and current prices
 *     tags:
 *       - Products
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search in product name, brand, model, or description
 *       - in: query
 *         name: ean
 *         schema:
 *           type: string
 *         description: Filter by EAN/GTIN
 *       - in: query
 *         name: brand
 *         schema:
 *           type: string
 *         description: Filter by brand name
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 200
 *           default: 20
 *         description: Number of results per page
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Pagination offset
 *       - in: query
 *         name: orderBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, name]
 *           default: updatedAt
 *         description: Sort by field
 *       - in: query
 *         name: sortDirection
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort direction
 *     responses:
 *       200:
 *         description: Successfully retrieved products
 */
router.get("/", productController.listProducts);

/**
 * @openapi
 * /products:
 *   post:
 *     summary: Create a new product manually
 *     description: Create a product entry without scraping (use /products/scrape for automatic scraping)
 *     tags:
 *       - Products
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: Product name
 *                 example: "Sony WH-1000XM5 Kopfhörer"
 *               ean:
 *                 type: string
 *                 description: EAN-13 or GTIN
 *                 example: "4548736139870"
 *               asin:
 *                 type: string
 *                 description: Amazon ASIN
 *                 example: "B09XS7JWHH"
 *               brand:
 *                 type: string
 *                 description: Brand name
 *                 example: "Sony"
 *               model:
 *                 type: string
 *                 description: Model number
 *                 example: "WH-1000XM5"
 *               category:
 *                 type: string
 *                 description: Product category
 *                 example: "Electronics"
 *               description:
 *                 type: string
 *                 description: Product description
 *               imageUrl:
 *                 type: string
 *                 description: Product image URL
 *               metadata:
 *                 type: object
 *                 description: Additional custom metadata
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Invalid request data
 *       500:
 *         description: Failed to create product
 */
router.post("/", productController.createProduct);

/**
 * @openapi
 * /products/scrape:
 *   post:
 *     summary: Scrape and save product from URL
 *     description: |
 *       **Main Feature**: Scrape product information (price, title, availability) from any shop URL and save to database.
 *
 *       Supports automatic shop detection for:
 *       - Amazon (all domains)
 *       - MediaMarkt
 *       - Generic shops (via custom selectors)
 *
 *       Features:
 *       - Automatic price tracking and history
 *       - Product matching by EAN
 *       - Alert triggering on price changes
 *       - Humanized browsing to avoid detection
 *     tags:
 *       - Products
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 description: Product URL to scrape
 *                 example: "https://www.amazon.de/dp/B09XS7JWHH"
 *               humanized:
 *                 type: boolean
 *                 default: true
 *                 description: Use humanized interactions (recommended to avoid bot detection)
 *               productData:
 *                 type: object
 *                 description: Optional product data to override scraped values
 *                 properties:
 *                   name:
 *                     type: string
 *                   category:
 *                     type: string
 *     responses:
 *       200:
 *         description: Product scraped and saved successfully
 *       400:
 *         description: Invalid URL
 *       500:
 *         description: Scraping failed
 */
router.post("/scrape", productController.scrapeProduct);

/**
 * @openapi
 * /products/{productId}:
 *   get:
 *     summary: Get product by ID
 *     description: Get detailed product information including all sources and current prices
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product found
 *       404:
 *         description: Product not found
 */
router.get("/:productId", productController.getProductById);

/**
 * @openapi
 * /products/{productId}:
 *   patch:
 *     summary: Update product
 *     description: Update product information (name, brand, category, etc.)
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               ean:
 *                 type: string
 *               brand:
 *                 type: string
 *               category:
 *                 type: string
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       404:
 *         description: Product not found
 */
router.patch("/:productId", productController.updateProduct);

/**
 * @openapi
 * /products/{productId}:
 *   delete:
 *     summary: Delete product
 *     description: Delete a product and all associated data (sources, prices, history, alerts)
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 */
router.delete("/:productId", productController.deleteProduct);

/**
 * @openapi
 * /products/{productId}/refresh:
 *   post:
 *     summary: Refresh product prices
 *     description: Re-scrape all sources for this product to update prices
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               humanized:
 *                 type: boolean
 *                 default: true
 *     responses:
 *       200:
 *         description: Prices refreshed successfully
 *       404:
 *         description: Product not found
 */
router.post("/:productId/refresh", productController.refreshProduct);

/**
 * @openapi
 * /products/{productId}/comparison:
 *   get:
 *     summary: Get price comparison
 *     description: Compare prices across all sources for this product
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Price comparison retrieved
 *       404:
 *         description: Product not found
 */
router.get("/:productId/comparison", productController.getPriceComparison);

/**
 * @openapi
 * /products/{productId}/alerts:
 *   get:
 *     summary: Get price alerts for product
 *     description: Get all active price alerts for this product
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Alerts retrieved successfully
 */
router.get("/:productId/alerts", productController.getProductAlerts);

/**
 * @openapi
 * /products/{productId}/alerts:
 *   post:
 *     summary: Create price alert
 *     description: |
 *       Create a price alert that triggers when conditions are met.
 *
 *       Alert types:
 *       - **below_price**: Trigger when price drops below target
 *       - **percentage_drop**: Trigger when price drops by X%
 *       - **back_in_stock**: Trigger when product comes back in stock
 *       - **price_error**: Trigger when price seems suspiciously low
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - name
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [below_price, percentage_drop, back_in_stock, price_error]
 *                 description: Alert type
 *               name:
 *                 type: string
 *                 description: Alert name
 *                 example: "Alert me when Sony headphones < €300"
 *               description:
 *                 type: string
 *                 description: Alert description
 *               targetPrice:
 *                 type: number
 *                 description: Target price (required for below_price type)
 *                 example: 299.99
 *               percentageThreshold:
 *                 type: number
 *                 description: Percentage threshold (required for percentage_drop type)
 *                 example: 20
 *               notifyEmail:
 *                 type: boolean
 *                 default: true
 *                 description: Send email notification
 *               notifyWebhook:
 *                 type: boolean
 *                 default: false
 *                 description: Send webhook notification
 *               webhookUrl:
 *                 type: string
 *                 description: Webhook URL (required if notifyWebhook is true)
 *               expiresAt:
 *                 type: string
 *                 format: date-time
 *                 description: Alert expiration date
 *     responses:
 *       201:
 *         description: Alert created successfully
 *       400:
 *         description: Invalid request data
 */
router.post("/:productId/alerts", productController.createPriceAlert);

/**
 * @openapi
 * /products/sources/{sourceId}/history:
 *   get:
 *     summary: Get price history
 *     description: Get historical price data for a product source
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: sourceId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Product source ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter from this date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter until this date
 *     responses:
 *       200:
 *         description: Price history retrieved
 */
router.get("/sources/:sourceId/history", productController.getPriceHistory);

/**
 * @openapi
 * /products/sources/{sourceId}/statistics:
 *   get:
 *     summary: Get price statistics
 *     description: Get min, max, average price and price change statistics
 *     tags:
 *       - Products
 *     parameters:
 *       - in: path
 *         name: sourceId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to analyze
 *     responses:
 *       200:
 *         description: Statistics retrieved
 */
router.get("/sources/:sourceId/statistics", productController.getPriceStatistics);

export const productRoutes = router;
