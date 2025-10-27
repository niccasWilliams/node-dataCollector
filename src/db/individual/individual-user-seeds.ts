
import {  User, Role } from "@/db/schema";
import { AppPermissions, AppPermissionValue, permissionService } from "@/routes/auth/roles/permissions/permission.service";
import { userService } from "@/routes/auth/users/user/user.service";
import { roleService } from "@/routes/auth/roles/roles/role.service";
import { roleAssignmentService } from "@/routes/auth/roles/role-assignments/role-assignment.service";
import { DateTime } from "luxon";


const individualUser: User[] = [


]

const individualRole = {
    name: "Individual",
    description: "Role for individual users with limited access",
};



const appIndividualPermissions: AppPermissionValue[] = [
    AppPermissions.UsersView,

];




export async function individualUserSeed() {
    let createdIndividualUser: User | null = null;
    let createdRole: Role | null = null;

    for (const userData of individualUser) {
        const createdUser = await userService.createUser(
            userData.externalUserId ? String(userData.externalUserId) : undefined,
            userData.email || undefined,
            userData.firstName || undefined,
            userData.lastName || undefined,
        );
        createdIndividualUser = createdUser;
    }

    // Create Individual Role

    createdRole = await roleService.createRole(individualRole.name, individualRole.description);
    console.log(`✅ Created role: ${createdRole.name}`);

    // Assign permissions to Individual Role
    for (const permissionName of appIndividualPermissions) {
        const permission = await permissionService.getByName(permissionName.toString());
        if (!permission) {
            console.error(`❌ Permission ${permissionName} not found.`);
            continue;
        } else {
            console.log(`✅ Found permission: ${permission.name}`);
            await permissionService.assignPermissionToRole(createdRole.id, permission.id, 1);
        }

    }

    // Assign Individual Role to first user
    if (createdIndividualUser && createdIndividualUser.id) {
        await roleAssignmentService.createRoleAssignment(createdIndividualUser.id, createdRole.id, DateTime.now().setZone("Europe/Berlin"), 1);
        console.log(`✅ Assigned role "${createdRole.name}" to user ${createdIndividualUser.email}`);
    } else {
        console.error("❌ No user found to assign the role.");
    }


    console.log(`✅ Individual USER leads seeded.`);
}