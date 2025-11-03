import type { Request, Response } from "express";
import { productMatchingService } from "@/services/matching/product-matching.service";
import { attributeExtractorService } from "@/services/matching/attribute-extractor.service";
import { productService } from "@/routes/products";
import { logger } from "@/utils/logger";

/**
 * Get all pending match suggestions
 */
export async function getPendingSuggestions(req: Request, res: Response) {
  try {
    const suggestions = await productMatchingService.getPendingSuggestions();

    // Enrich with product and merged product details
    const enrichedSuggestions = await Promise.all(
      suggestions.map(async (suggestion) => {
        const product = await productService.getProductById(suggestion.productId);
        const mergedProduct = await productService.getMergedProductById(suggestion.mergedProductId);

        return {
          ...suggestion,
          product,
          mergedProduct,
        };
      })
    );

    res.json({
      success: true,
      data: enrichedSuggestions,
      count: enrichedSuggestions.length,
    });
  } catch (error) {
    logger.error("Failed to get pending suggestions:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get pending suggestions",
    });
  }
}

/**
 * Accept a match suggestion (merge products)
 */
export async function acceptSuggestion(req: Request, res: Response) {
  try {
    const suggestionId = parseInt(req.params.id);
    const { userId, notes } = req.body;

    if (isNaN(suggestionId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid suggestion ID",
      });
    }

    await productMatchingService.acceptSuggestion(suggestionId, userId);

    logger.info(`Accepted match suggestion ${suggestionId}`);

    res.json({
      success: true,
      message: "Match suggestion accepted and products merged",
    });
  } catch (error) {
    logger.error("Failed to accept suggestion:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to accept suggestion",
    });
  }
}

/**
 * Reject a match suggestion
 */
export async function rejectSuggestion(req: Request, res: Response) {
  try {
    const suggestionId = parseInt(req.params.id);
    const { userId, notes } = req.body;

    if (isNaN(suggestionId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid suggestion ID",
      });
    }

    await productMatchingService.rejectSuggestion(suggestionId, userId, notes);

    logger.info(`Rejected match suggestion ${suggestionId}`);

    res.json({
      success: true,
      message: "Match suggestion rejected",
    });
  } catch (error) {
    logger.error("Failed to reject suggestion:", error);
    res.status(500).json({
      success: false,
      error: "Failed to reject suggestion",
    });
  }
}

/**
 * Find matches for a specific product
 */
export async function findMatchesForProduct(req: Request, res: Response) {
  try {
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid product ID",
      });
    }

    const matches = await productMatchingService.findMatches(productId);

    // Enrich matches with product details
    const enrichedMatches = await Promise.all(
      matches.map(async (match) => {
        const product = await productService.getProductById(match.productId);
        return {
          ...match,
          product,
        };
      })
    );

    res.json({
      success: true,
      data: enrichedMatches,
      count: enrichedMatches.length,
    });
  } catch (error) {
    logger.error("Failed to find matches:", error);
    res.status(500).json({
      success: false,
      error: "Failed to find matches",
    });
  }
}

/**
 * Process matches for a product (auto-merge or create suggestions)
 */
export async function processMatchesForProduct(req: Request, res: Response) {
  try {
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid product ID",
      });
    }

    const matches = await productMatchingService.findMatches(productId);
    const result = await productMatchingService.processMatches(productId, matches);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error("Failed to process matches:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process matches",
    });
  }
}

/**
 * Get product attributes
 */
export async function getProductAttributes(req: Request, res: Response) {
  try {
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid product ID",
      });
    }

    const attributes = await attributeExtractorService.getProductAttributes(productId);

    res.json({
      success: true,
      data: attributes,
      count: attributes.length,
    });
  } catch (error) {
    logger.error("Failed to get product attributes:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get product attributes",
    });
  }
}

/**
 * Extract attributes for a product
 */
export async function extractAttributesForProduct(req: Request, res: Response) {
  try {
    const productId = parseInt(req.params.productId);

    if (isNaN(productId)) {
      return res.status(400).json({
        success: false,
        error: "Invalid product ID",
      });
    }

    const product = await productService.getProductById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        error: "Product not found",
      });
    }

    const attributes = await attributeExtractorService.extractAndSaveAttributes(
      productId,
      product.name,
      product.metadata as Record<string, any>
    );

    res.json({
      success: true,
      data: attributes,
      count: attributes.length,
    });
  } catch (error) {
    logger.error("Failed to extract attributes:", error);
    res.status(500).json({
      success: false,
      error: "Failed to extract attributes",
    });
  }
}
