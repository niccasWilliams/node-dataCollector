import { Request, Response } from "express";

import { responseHandler } from "@/lib/communication";
import { getLanguageFromRequest, getExternalUserIdFromRequest } from "@/util/utils";
import { logService } from "@/routes/log-service/log-service.service";
import { permissionUseCase } from "@/routes/auth/roles/permissions/permission.useCase";
import { AppPermissions } from "@/routes/auth/roles/permissions/permission.service";


class LogServiceController {

    async getLogs(req: Request, res: Response) {
        try {
            const language = await getLanguageFromRequest(req);
            if (!language) return responseHandler(res, 400, "Invalid Request");

            const logs = await logService.getLogs();
            const userId = getExternalUserIdFromRequest(req)
            if (!userId) return responseHandler(res, 401, "Invalid Request");
            let canDelete = false
            if (logs) {
                const canDeleteFromDb = await permissionUseCase.hasExternalUserPermission(userId, AppPermissions.LogDelete);
                canDelete = canDeleteFromDb;
            }

            return responseHandler(res, 200, undefined, { logs: logs, canDelete: canDelete });
        } catch (error: any) {
            console.error("Error in getLogs:", error);
            return responseHandler(res, 500, error.message || "Internal Server Error");
        }
    }

    async deleteLog(req: Request, res: Response) {
        try {
            const logId = parseInt(req.params.logId, 10);
            if (isNaN(logId)) return responseHandler(res, 400, "Invalid Request");
            const userId = getExternalUserIdFromRequest(req)
            if (!userId) return responseHandler(res, 401, "Invalid Request");
            const canDelete = await permissionUseCase.hasExternalUserPermission(userId, AppPermissions.LogDelete);
            if (!canDelete) return responseHandler(res, 403, "Forbidden: No permission to delete logs");
            await logService.deleteLog(logId);
            return responseHandler(res, 200, "Log deleted successfully");
        } catch (error: any) {
            console.error("Error in deleteLog:", error);
            return responseHandler(res, 500, error.message || "Internal Server Error");
        }
    }


    async deleteLogs(req: Request, res: Response) {
        try {
            const logIdsParam = req.params.logIds;
            if (!logIdsParam) return responseHandler(res, 400, "No logs to delete");
            const logIds = logIdsParam.split(",").map(id => parseInt(id, 10));
            if (logIds.some(id => isNaN(id))) return responseHandler(res, 400, "Invalid Request: One or more log IDs are not valid numbers");

            const userId = getExternalUserIdFromRequest(req)
            if (!userId) return responseHandler(res, 401, "Invalid Request");
            const canDelete = await permissionUseCase.hasExternalUserPermission(userId, AppPermissions.LogDelete);
            if (!canDelete) return responseHandler(res, 403, "Forbidden: No permission to delete logs");

            await logService.deleteLogs(logIds);


            return responseHandler(res, 200, "Logs deleted successfully");
        } catch (error: any) {
            console.error("Error in deleteLogs:", error);
            return responseHandler(res, 500, error.message || "Internal Server Error");
        }
    }

}



export const logServiceController = new LogServiceController();