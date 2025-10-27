import { Request, Response } from "express";
import { responseHandler } from "@/lib/communication";
import { getUserIdFromRequest } from "@/util/utils";
import { Role, User } from "@/db/schema";
import { permissionUseCase } from "@/routes/auth/roles/permissions/permission.useCase";
import { roleService } from "@/routes/auth/roles/roles/role.service";
import { appInfoUseCase } from "./app-info.useCase";
import { userService } from "@/routes/auth/users/user/user.service";


export type InfoData = {
    plannerUser: User;
    plannerUsers?: User[];
    userRoles: Role[];
}


class AppInfoController {


    async getAppInfo(req: Request, res: Response) {
        try {
            const requestedByUserId = await getUserIdFromRequest(req);
            if (!requestedByUserId) return responseHandler(res, 400, "Invalid Request: User ID not found");
            const requestedBy = await userService.getUserById(requestedByUserId);
            if (!requestedBy) return responseHandler(res, 404, "User not found");


           
            const userRoles = await roleService.getActiveUserRoles(requestedByUserId);

            const infoData: InfoData = {
                plannerUser: requestedBy,
                userRoles,

            };

            return responseHandler(res, 200, undefined, infoData);
        } catch (error: any) {
            console.error("Error in getAppInfo:", error);
            return responseHandler(res, 500, error.message || "Internal Server Error");
        }
    }

    async getOwnPermissions(req: Request, res: Response) {
        try {
            const userId = await getUserIdFromRequest(req);
            if (!userId) return responseHandler(res, 401, "Unauthorized");

            const permissions = await permissionUseCase.getUserPermissions(userId);
            return responseHandler(res, 200, undefined, permissions);
        } catch (error) {
            return responseHandler(res, 500, "Internal Server Error");
        }

    }






}


export const appInfoController = new AppInfoController();