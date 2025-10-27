// INDIVIDUAL ROUTES
// This file is NOT synced with the template
// Add your app-specific routes here

import express from "express";

/**
 * Register individual app-specific routes
 * This function is called from routes.ts after base routes are registered
 */
const registerIndividualRoutes = (app: express.Application) => {

  // Example: Add your individual routes here
  // import articleRouter from "./routes/articles/article.route";
  // app.use("/articles", articleRouter);

  // import orderRouter from "./routes/orders/order.route";
  // app.use("/orders", orderRouter);

};

export default registerIndividualRoutes;
