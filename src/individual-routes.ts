// INDIVIDUAL ROUTES
// This file is NOT synced with the template
// Add your app-specific routes here

import express from "express";

import browserRouter from "./routes/browser/browser.route";
import { websiteRoutes } from "./routes/websites/website.route";
import { productRoutes } from "./routes/products/product.route";
import { productMatchingRouter } from "./routes/product-matching";

/**
 * Register individual app-specific routes
 * This function is called from routes.ts after base routes are registered
 */
const registerIndividualRoutes = (app: express.Application) => {

  // Browser automation routes
  app.use("/browser", browserRouter);
  app.use("/websites", websiteRoutes);

  // Product tracking and price monitoring routes
  app.use("/products", productRoutes);

  // Product matching and attributes routes
  app.use("/product-matching", productMatchingRouter);

};

export default registerIndividualRoutes;
