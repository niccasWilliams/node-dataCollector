// BASE ROUTES
// This file contains all base template routes
// DO NOT add app-specific routes here - use individual-routes.ts instead

import express from "express";

// Base route imports
import cronJobRouter from "./routes/internal-jobs/jobs.route";
import appLogRouter from "./routes/log-service/log-service.route";
import settingsRouter from "./routes/settings/settings.route";
import roleRouter from "./routes/auth/roles/roles/role.route";
import permissionRouter from "./routes/auth/roles/permissions/permission.route";
import roleAssignmentRouter from "./routes/auth/roles/role-assignments/role-assignment.route";
import userRouter from "./routes/auth/users/user/user.route";
import webhookRouter from "./routes/webhooks/webhook.route";
import appInfoRouter from "./routes/appInfo/app-info.route";
import userActivityRouter from "./routes/auth/users/activitys/user-activity.route";

// Individual routes import
import registerIndividualRoutes from "./individual-routes";


const registerRoutes = (app: express.Application) => {
  app.get("/", (_req, res) => {
    res.sendFile("index.html", { root: "public" });
  });

  // Base Template Routes
  app.use("/app-info", appInfoRouter);
  app.use("/settings", settingsRouter);
  app.use("/webhooks", webhookRouter);
  app.use("/app-logs", appLogRouter)
  app.use("/cronJobs", cronJobRouter);

  // Auth & User Management Routes
  app.use("/users", userRouter);
  app.use("/user-activity", userActivityRouter);
  app.use("/roles", roleRouter);
  app.use("/permissions", permissionRouter);
  app.use("/role-assignments", roleAssignmentRouter);

  // Register individual app-specific routes
  registerIndividualRoutes(app);

};

export default registerRoutes;
