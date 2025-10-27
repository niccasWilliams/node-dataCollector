import express, { Router } from "express";
import { AccessControl } from "@/routes/middleware";
import { webhookController } from "./webhook.controller";
import { AppPermissions } from "@/routes/auth/roles/permissions/permission.service";

const router: Router = express.Router();


router.use(AccessControl.isAuthUser());

router.get("/getAll", AccessControl.hasPermission(AppPermissions.WebhookView), webhookController.getWebhooks);

router.delete("/delete/:webhookId", AccessControl.hasPermission(AppPermissions.WebhookDelete), webhookController.deleteWebhook);
router.delete("/delete/mass/:webhookIds", AccessControl.hasPermission(AppPermissions.WebhookDelete), webhookController.deleteWebhook);


export default router;