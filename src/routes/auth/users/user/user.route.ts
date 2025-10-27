import express, { Router } from "express";
import { userController } from "@/routes/auth/users/user/user.controller";
import { AccessControl } from "@/routes/middleware";
import { AppPermissions } from "@/routes/auth/roles/permissions/permission.service";


const router: Router = express.Router();



router.post("/create", AccessControl.isFrontendRequest, userController.createUser);
router.delete("/delete/external/:frontendUserId", AccessControl.isAuthUser(), userController.deleteFrontendUser);
router.put("/update/external/:frontendUserId", AccessControl.isAuthUser(), userController.updateUser); //user has to be authenticated to update own profile


router.delete("/delete/:userId", AccessControl.hasPermission(AppPermissions.UsersManage), userController.deleteUser);

router.get("/getAll", AccessControl.hasPermission(AppPermissions.UsersView), userController.getAllUsers);
router.get("/getByEmail/:email", AccessControl.hasPermission(AppPermissions.UsersView), userController.getUserByEmail);


router.get("/getByExternalUserId/:externalUserId", userController.getUserByExternalUserId);
router.get("/getById/:userId", userController.getUserById);

export default router;
