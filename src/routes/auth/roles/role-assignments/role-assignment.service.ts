import { DateTime } from "luxon";
import { eq, and, inArray, or, sql, ilike, asc, desc, lt, gte, lte, isNull, gt } from "drizzle-orm";
import { database } from "@/db";
import {  RoleAssignment, roleAssignments, RoleAssignmentStatus, UserId,  } from "@/db/schema";
import { addMinutes, nowInBerlin } from "@/util/utils";


class RoleAssignmentService {
    private db;

    constructor() {
        this.db = database;
    }





    async createRoleAssignment(userId: UserId, roleId: number, validFrom: DateTime, assignedBy: UserId, trx = database): Promise<void> {
        try {
            let finalStatus: RoleAssignmentStatus = "active";
          
            await trx
                .insert(roleAssignments)
                .values({
                    roleId,
                    userId,
                    assignedBy,
                    createdAt: nowInBerlin(),
                    validFrom: validFrom.toJSDate(),
                    status: finalStatus,
                })
                .returning();

        } catch (error) {
            console.error("Error assigning user to role:", error);
            throw new Error("Error assigning user to role");
        }
    }




    async revokeUserFromRole(userId: number, roleId: number, revokedBy: UserId, trx = database): Promise<void> {
        try {
            await trx
                .update(roleAssignments)
                .set({ validTo: nowInBerlin(), status: "revoked", revokedBy })
                .where(
                    and(
                        eq(roleAssignments.userId, userId),
                        eq(roleAssignments.roleId, roleId),
                    )
                );
        } catch (error) {
            console.error("Error invalidating user role:", error);
            throw new Error("Error invalidating user role");
        }
    }


    async getAllRoleAssignments(trx = database) {
        try {
            const assignments = await trx
                .select()
                .from(roleAssignments);
            return assignments;
        } catch (error) {
            console.error("Error fetching all role assignments:", error);
            throw new Error("Error fetching all role assignments");
        }
    }


    async getUserRoleAssignments(userId: number, trx = database): Promise<RoleAssignment[]> {
        try {
            const now = nowInBerlin();

            const assignments = await trx
                .select()
                .from(roleAssignments)
                .where(
                    and(
                        eq(roleAssignments.userId, userId),
                        eq(roleAssignments.status, "active"),
                        lte(roleAssignments.validFrom, now),
                        or(
                            isNull(roleAssignments.validTo), 
                            gt(roleAssignments.validTo, now)
                        )
                    )
                )
                .orderBy(asc(roleAssignments.validFrom));

            return assignments;
        } catch (error) {
            console.error("Error fetching user role assignments:", error);
            throw new Error("Error fetching user role assignments");
        }
    }



}

export const roleAssignmentService = new RoleAssignmentService();