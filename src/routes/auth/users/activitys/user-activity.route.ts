import express, { Router } from "express";
import { AccessControl } from "@/routes/middleware";
import { AppPermissions } from "@/routes/auth/roles/permissions/permission.service";
import { userActivityController } from "./user-activity.controller";


const router: Router = express.Router();



// ===== ADMIN ROUTES (beliebige User-Aktivitäten) =====

/**
 * GET /user-activity/users
 * Admin: Get all users with quick activity stats
 * Perfect for admin user lists/tables
 * Requires: users_view permission
 *
 * Response: Array of { user: {...}, activityStats: { lastActivity, requestsToday, requestsThisWeek, requestsThisMonth } }
 */
router.get("/users", AccessControl.hasPermission(AppPermissions.UsersView), userActivityController.getAllUsersWithActivityStats);

/**
 * POST /user-activity/user/:userId
 * Admin: Get detailed activity overview for a specific user (with filters and pagination)
 * Perfect for user detail pages with comprehensive analytics
 * Requires: users_view permission
 *
 * Body: {
 *   search?: string,                    // Search in endpoints, errors, methods, userAgent
 *   page?: number,                      // Pagination: page number (1-indexed)
 *   resultsPerPage?: number,            // Pagination: items per page
 *   statusCodes?: number[],             // Filter by HTTP status codes (e.g., [200, 404])
 *   date?: string (YYYY-MM-DD),         // Single day filter (takes priority)
 *   startDate?: string (YYYY-MM-DD),    // Date range start (ignored if 'date' is set)
 *   endDate?: string (YYYY-MM-DD),      // Date range end (ignored if 'date' is set)
 *   days?: number                       // Last N days (default: 30, ignored if date/startDate/endDate is set)
 * }
 *
 * Response: {
 *   data: UserWithActivityOverview[],
 *   pagination: {
 *     page,
 *     resultsPerPage,
 *     totalPages,             // Total number of pages
 *     totalResults,               // Total number of requests (not days)
 *     availableStatusCodes        // All unique status codes for filter dropdown
 *   }
 * }
 */
router.post("/user/:userId", AccessControl.hasPermission(AppPermissions.UsersView), userActivityController.getUserActivityOverview);


export default router;
