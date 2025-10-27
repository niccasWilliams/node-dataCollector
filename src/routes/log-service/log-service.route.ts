import express, { Router } from "express";

import { AccessControl } from "@/routes/middleware";
import { logServiceController } from "./log-service.controller";
import { AppPermissions } from "@/routes/auth/roles/permissions/permission.service";


const router: Router = express.Router();


router.use(AccessControl.isAuthUser());


router.get("/getAll", AccessControl.hasPermission(AppPermissions.LogView), logServiceController.getLogs)
router.delete("/delete/:logId", AccessControl.hasPermission(AppPermissions.LogDelete), logServiceController.deleteLog);
router.delete("/delete/mass/:logIds", AccessControl.hasPermission(AppPermissions.LogDelete), logServiceController.deleteLogs);



export default router;
