import express, { Router } from "express";
import { permissionController } from "./permission.controller";
import { AccessControl } from "@/routes/middleware";
import { AppPermissions } from "./permission.service";


const router: Router = express.Router();

//PERMISSION CHECK

//TODO: we need better permission management when group merisissions are implemented
router.use(AccessControl.hasPermission(AppPermissions.PermissionsManage));

router.post("/create", permissionController.createPermission);

// Sync default permissions with database
router.post("/sync", permissionController.syncPermissions);

router.get("/getAll", permissionController.getAllPermissions);

router.post("/assign/:roleId/:permissionId", permissionController.assignPermissionToRole);
router.delete("/unassign/:roleId/:permissionId", permissionController.unassignPermissionFromRole);


// History endpoint - requires special permission
router.get("/getAssignments", AccessControl.hasPermission(AppPermissions.PermissionsHistoryView), permissionController.getAssignments);



export default router;
