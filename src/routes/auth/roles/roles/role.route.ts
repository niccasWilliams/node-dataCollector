import express, { Router } from "express";
import { roleController } from "./role.controller";
import { AccessControl } from "@/routes/middleware";
import { AppPermissions } from "../permissions/permission.service";


const router: Router = express.Router();


router.use(AccessControl.hasPermission(AppPermissions.RolesManage));

router.post("/create", roleController.createRole);
router.delete("/delete/:roleId", roleController.deleteRole);
router.put("/update/:roleId", roleController.updateRole);




router.get("/getById/:roleId", roleController.getRoleById);
router.get("/getAll", roleController.getAllRoles);





export default router;
