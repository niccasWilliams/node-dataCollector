
import { eq, and, inArray, or, sql, ilike, lt, isNull, asc, desc } from "drizzle-orm";
import { database } from "@/db";
import { User, UserId, users } from "@/db/schema";
import { nowInBerlin } from "@/util/utils";


class UserService {



    async createUser(externalUserId?: string, email?: string, firstName?: string, lastName?: string, trx = database): Promise<User> {
        try {
            if (!externalUserId && !email && !firstName && !lastName) throw new Error("❌ Missing at least one required field: externalUserId, email, firstName, or lastName");

            // Check if user with this email already exists
            if (email) {
                const existingUser = await this.getUserByEmail(email, trx);
                if (existingUser && existingUser.id) {
                    console.log(`✅ User with email ${email} already exists. Updating data instead of creating duplicate.`);
                    // Update existing user's data if provided
                    const updateData: Partial<User> = {};
                    if (firstName) updateData.firstName = firstName;
                    if (lastName) updateData.lastName = lastName;
                    if (externalUserId) updateData.externalUserId = externalUserId;

                    if (Object.keys(updateData).length > 0) {
                        const [updatedUser] = await trx
                            .update(users)
                            .set(updateData)
                            .where(eq(users.id, existingUser.id))
                            .returning();
                        return updatedUser;
                    }

                    return existingUser;
                }
            }

            // Check if user with this externalUserId already exists
            if (externalUserId) {
                const existingUserByExtId = await trx
                    .select()
                    .from(users)
                    .where(eq(users.externalUserId, externalUserId))
                    .limit(1);

                if (existingUserByExtId.length > 0) {
                    const existingUser = existingUserByExtId[0];
                    if (existingUser && existingUser.id) {
                        console.log(`✅ User with externalUserId ${externalUserId} already exists. Updating name instead of creating duplicate.`);

                        // Update existing user's name if provided
                        const updateData: Partial<User> = {};
                        if (firstName) updateData.firstName = firstName;
                        if (lastName) updateData.lastName = lastName;
                        if (email) updateData.email = email;

                        if (Object.keys(updateData).length > 0) {
                            const [updatedUser] = await trx
                                .update(users)
                                .set(updateData)
                                .where(eq(users.id, existingUser.id))
                                .returning();
                            return updatedUser;
                        }

                        return existingUser;
                    }
                }
            }

            // No existing user found, create new one
            const [result] = await trx
                .insert(users)
                .values({ externalUserId, email, firstName, lastName, createdAt: nowInBerlin() })
                .returning();
            return result;
        } catch (error) {
            console.error("Error creating user:", error);
            throw new Error("Error creating user");
        }

    }

    async deleteUser(userId: number, trx = database): Promise<User | undefined> {
        try {
            const [result] = await trx
                .delete(users)
                .where(eq(users.id, userId))
                .returning();
            return result;
        } catch (error) {
            console.error("Error deleting user:", error);
            throw new Error("Error deleting user");
        }
    }

    async deleteUserByFrontendUserId(frontendUserId: string, trx = database): Promise<User | undefined> {
        try {
            const [result] = await trx
                .delete(users)
                .where(eq(users.externalUserId, frontendUserId))
                .returning();
            return result;
        } catch (error) {
            console.error("Error deleting user:", error);
            throw new Error("Error deleting user");
        }
    }




    async getUserById(userId: number, trx = database): Promise<User | undefined> {
        try {
            const [result] = await trx
                .select()
                .from(users)
                .where(eq(users.id, userId));
            return result;
        } catch (error) {
            console.error("Error getting user by ID:", error);
            throw new Error("Error getting user by ID");
        }
    }

    async getUserByEmail(email: string, trx = database): Promise<User | undefined> {
        try {
            const [result] = await trx
                .select()
                .from(users)
                .where(eq(users.email, email));
            return result;
        } catch (error) {
            console.error("Error getting user by email:", error);
            throw new Error("Error getting user by email");
        }
    }

    async getUserByExternalUserId(externalUserId: number, trx = database): Promise<User | undefined> {
        try {
            const userId = externalUserId.toString();
            const [result] = await trx
                .select()
                .from(users)
                .where(eq(users.externalUserId, userId));
            return result;
        } catch (error) {
            console.error("Error getting user by external user ID:", error);
            throw new Error("Error getting user by external user ID");
        }
    }

    async getAllUsers(trx = database): Promise<User[]> {
        try {
            const result = await trx
                .select()
                .from(users);
            return result;
        } catch (error) {
            console.error("Error getting all users:", error);
            throw new Error("Error getting all users");
        }
    }








    async updateUserByFrontendUserId(frontendUserId: string, user: Partial<User>, trx = database): Promise<User> {
        try {
            const [result] = await trx
                .update(users)
                .set({ ...user, updatedAt: nowInBerlin() })
                .where(eq(users.externalUserId, frontendUserId))
                .returning();
            return result;
        } catch (error) {
            console.error("Error updating user:", error);
            throw new Error("Error updating user");
        }
    }

   
   async getUsersByIds(userIds: number[], trx = database): Promise<User[]> {
        try {
            const result = await trx
                .select()
                .from(users)
                .where(inArray(users.id, userIds));
            return result;
        } catch (error) {
            console.error("Error getting users by IDs:", error);
            throw new Error("Error getting users by IDs");
        }    
    }
   

    


}

export const userService = new UserService();