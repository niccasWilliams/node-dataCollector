import express, { Router } from "express";

import { AccessControl } from "@/routes/middleware";
import { roleAssignmentController } from "./role-assignment.controller";
import { AppPermissions } from "../permissions/permission.service";


const router: Router = express.Router();

// Write operations require ManageRoles permission
router.post("/create/:userId/:roleId", AccessControl.hasPermission(AppPermissions.RolesManage), roleAssignmentController.createRoleAssignment);
router.delete("/delete/:userId/:roleId", AccessControl.hasPermission(AppPermissions.RolesManage), roleAssignmentController.revokeUserFromRole);


// History endpoint - requires special permission
router.get("/getAll", AccessControl.hasPermission(AppPermissions.RolesHistoryView), roleAssignmentController.getAllRoleAssignments);

// User-specific assignments can be viewed with RolesManage permission
router.get("/getUserAssignments/:userId", AccessControl.hasPermission(AppPermissions.RolesManage), roleAssignmentController.getUserRoleAssignments);




export default router;
