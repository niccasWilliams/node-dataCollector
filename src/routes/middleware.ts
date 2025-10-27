import { Request, Response, NextFunction } from "express";
import { responseHandler } from "@/lib/communication";
import jwt from "jsonwebtoken";
import { AppPermissions, permissionService } from "./auth/roles/permissions/permission.service";
import { permissionUseCase } from "./auth/roles/permissions/permission.useCase";
import { getExternalUserIdFromRequest } from "@/util/utils";
import { userActivityService } from "./auth/users/activitys/user-activity.service";
import { userController } from "./auth/users/user/user.controller";
import { userService } from "@/routes/auth/users/user/user.service";


const SKIP_TRACKING: Array<{ method?: string; pattern: RegExp }> = [
    // exakte DELETE-Route: /users/delete/external/:id
    { method: "DELETE", pattern: /^\/users\/delete\/external\/\d+$/ },
    // ggf. weitere Routen:
    // { pattern: /^\/healthz$/ },
];

function shouldSkipTracking(req: Request) {
    const path = req.originalUrl.split("?")[0]; // Querystring ignorieren
    const method = req.method.toUpperCase();
    return SKIP_TRACKING.some(({ method: m, pattern }) => {
        if (m && m.toUpperCase() !== method) return false;
        return pattern.test(path);
    });
}



export class AccessControl {




    static skipIfLocal(middleware: (req: Request, res: Response, next: NextFunction) => any) {
        const isLocal = process.env.HOST_NAME === "localhost";
        if (isLocal) return (req: Request, res: Response, next: NextFunction) => next();
        return middleware;
    }




    static onlyAllowHttp(req: Request, res: Response, next: NextFunction) {
        if (req.secure) {
            return res.status(403).send("This route is not accessible");
        }
        next();
    }

    static onlyAllowHttps(req: Request, res: Response, next: NextFunction) {
        if (!req.secure) {
            return res.status(403).send("This route is not accessible");
        }
        next();
    }

    static isBackendToBackend(req: Request, res: Response, next: NextFunction) {
        const authHeader = req.headers["authorization"];
        const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : null;

        if (!token || token !== process.env.BACKEND_TO_BACKEND_API_KEY) {
            return res.status(403).send("Forbidden: Invalid API Key");
        }
        next();
    }



    static isFrontendRequest(req: Request, res: Response, next: NextFunction) {
        const authHeader = req.headers["authorization"];
        const token = typeof authHeader === "string" && authHeader.startsWith("Bearer ")
            ? authHeader.slice(7)
            : null;

        if (!token) {
            console.error("❌ No token found in Authorization header");
            return res.status(403).send("Forbidden: Missing authorization token");
        }

        const API_KEY = process.env.FRONTEND_API_KEY;
        if (!API_KEY) {
            console.error("❌ FRONTEND_API_KEY is not set");
            return res.status(500).send("Server misconfigured");
        }

        try {
            const payload = jwt.verify(token, API_KEY);

            if (!payload || typeof payload !== "object") {
                console.error("❌ Invalid payload structure");
                return res.status(403).send("Forbidden: Invalid token payload");
            }

            // Extract userId
            const userId = "userId" in payload ? parseInt((payload as any).userId, 10) : undefined;

            if (userId !== undefined && (isNaN(userId) || userId <= 0)) {
                console.error("❌ Invalid userId:", userId);
                return res.status(403).send("Forbidden: Invalid userId in token");
            }

            // Extract client userAgent and ipAddress from JWT token
            const clientUserAgent = "userAgent" in payload ? (payload as any).userAgent : undefined;
            const clientIpAddress = "ipAddress" in payload ? (payload as any).ipAddress : undefined;

            // Attach user info and client data to request
            (req as any).tokenPayload = {
                userId,
                clientUserAgent,
                clientIpAddress
            };

            next();
        } catch (error) {
            console.error("❌ JWT verification failed:", error instanceof Error ? error.message : error);
            return res.status(403).send("Forbidden: Invalid or expired token");
        }
    }

    static isAuthUser() {
        return this.skipIfLocal(async (req: Request, res: Response, next: NextFunction) => {
            try {
                const { valid, userId, userAgent, ipAddress } = await userController.verifyToken(req);
                if (!valid || !userId) return responseHandler(res, 401, "Unauthorized: Invalid token");


                const user = await userService.getUserByExternalUserId(userId);
                if (!user) return responseHandler(res, 403, "Forbidden: User not found");

                console.log("✅ User Auth Success:", user.id, user.email);





                // Track user daily activity AFTER response (to capture status code and error)
                if (user.id) {
                    const uid = user.id; // vermeidet Shadowing von userId
                    const endpoint = req.originalUrl || req.url;
                    const method = req.method;

                    // Intercept res.json, um evtl. Fehlermeldung zu greifen
                    const originalJson = res.json.bind(res);
                    let errorMessage: string | undefined;

                    res.json = function (body: any) {
                        if (res.statusCode >= 400 && body?.message) {
                            errorMessage = body.message;
                        }
                        return originalJson(body);
                    };

                    res.on("finish", () => {
                        const statusCode = res.statusCode;

                        // ⛔ Früh aussteigen, wenn Route vom Tracking ausgeschlossen ist
                        if (shouldSkipTracking(req)) {
                            console.log("🚫 Skipping activity tracking for:", req.method, req.originalUrl);
                            return; // <-- WICHTIG!
                        }

                        userActivityService
                            .trackDailyActivity(
                                uid,
                                endpoint,
                                method,
                                statusCode,
                                errorMessage,
                                userAgent,
                                ipAddress
                            )
                            .catch((err) => {
                                console.error("❌ Failed to track user activity:", err);
                            });
                    });
                }

                // Optional: attach user to request
                (req as any).user = user;

                next();
            } catch (error: any) {
                console.error("❌ User Auth Error:", error);
                return responseHandler(res, 500, "Internal Server Error");
            }
        });
    }

    static isJob(req: Request, res: Response, next: NextFunction) {
        try {
            const authHeader = req.headers.authorization;

            // Format: "Bearer <token>"
            if (!authHeader || !authHeader.startsWith("Bearer ")) {
                return res.status(401).send("Unauthorized: Invalid auth format");
            }

            const token = authHeader.split(" ")[1];
            const expectedToken = process.env.CRON_JOB_SECRET;

            if (!expectedToken) {
                console.error("❌ CRON_JOB_SECRET is not set");
                return res.status(500).send("Server misconfigured");
            }

            if (token !== expectedToken) {
                return res.status(401).send("Unauthorized: Invalid token");
            }

            return next();
        } catch (error) {
            console.error("❌ Error in isJob middleware:", error);
            return res.status(500).send("Internal Server Error");
        }
    }




    static hasPermission(requiredPermission: AppPermissions) {
        return async (req: Request, res: Response, next: NextFunction) => {
            try {
                const userId = getExternalUserIdFromRequest(req);
                if (!userId || isNaN(userId)) {
                    console.error("❌ Unauthorized: Invalid user ID");
                    return responseHandler(res, 401, "Unauthorized: Invalid user ID");
                }

                const user = await userService.getUserByExternalUserId(userId);
                if (!user || !user.id) {
                    console.error("❌ Forbidden: User not found");
                    return responseHandler(res, 403, "Forbidden: User not found");
                }

                const userPermissions = await permissionUseCase.getUserPermissions(user.id);

                const hasPermission = userPermissions.some(p => p.name === requiredPermission);

                if (!hasPermission) {
                    console.error(`❌ Forbidden: Missing permission "${requiredPermission}" for user ${user.id}`);
                    return responseHandler(res, 403, `Forbidden: Missing permission "${requiredPermission}"`);
                }

                next();
            } catch (error) {
                console.error("Permission Check Error:", error);
                return responseHandler(res, 500, "Internal Server Error");
            }
        };
    }

}