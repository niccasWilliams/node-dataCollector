import { Router } from "express";
import * as controller from "./product-matching.controller";

const router = Router();


router.get("/suggestions", controller.getPendingSuggestions);

/**
 * POST /api/product-matching/suggestions/:id/accept
 * Accept a match suggestion
 */
router.post("/suggestions/:id/accept", controller.acceptSuggestion);

/**
 * POST /api/product-matching/suggestions/:id/reject
 * Reject a match suggestion
 */
router.post("/suggestions/:id/reject", controller.rejectSuggestion);

/**
 * GET /api/product-matching/products/:productId/matches
 * Find potential matches for a product
 */
router.get("/products/:productId/matches", controller.findMatchesForProduct);

/**
 * POST /api/product-matching/products/:productId/process-matches
 * Process matches for a product (create suggestions or auto-merge)
 */
router.post("/products/:productId/process-matches", controller.processMatchesForProduct);

/**
 * GET /api/product-matching/products/:productId/attributes
 * Get attributes for a product
 */
router.get("/products/:productId/attributes", controller.getProductAttributes);

/**
 * POST /api/product-matching/products/:productId/extract-attributes
 * Extract and save attributes for a product
 */
router.post("/products/:productId/extract-attributes", controller.extractAttributesForProduct);

export default router;
