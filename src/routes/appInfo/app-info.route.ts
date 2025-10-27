import express, { Router } from "express";
import { AccessControl } from "@/routes/middleware";
import { AppPermissions } from "@/routes/auth/roles/permissions/permission.service";
import { appInfoController } from "./app-info.controller";


const router: Router = express.Router();

router.use(AccessControl.isAuthUser());

router.get("/", appInfoController.getAppInfo)

router.get("/ownPermissions", appInfoController.getOwnPermissions)

export default router;
