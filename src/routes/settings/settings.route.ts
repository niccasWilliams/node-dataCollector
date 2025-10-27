import express, { Router } from "express";

import { AccessControl } from "@/routes/middleware";
import { settingsController } from "@/routes/settings/settings.controller";
import { AppPermissions } from "@/routes/auth/roles/permissions/permission.service";



const router: Router = express.Router();


router.use(AccessControl.isAuthUser());




router.get("/getAll", settingsController.getAll)

router.put("/update/:settingId/:key", AccessControl.hasPermission(AppPermissions.SettingsEdit), settingsController.updateAppSetting);



export default router;
