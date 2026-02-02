import { User } from "../../modules/user/models/User.model.js";
import {
  IUser,
  IAuthProvider,
  Role,
  UserStatus,
} from "../../modules/user/interfaces/user.interface.js";
import { config } from "../../config/index.js";
import { logger } from "./logger.js";

export const seedSuperAdmin = async () => {
  try {
    // Check if super admin email is configured
    const superAdminEmail =
      process.env.SUPER_ADMIN_EMAIL || "admin@sparkcollection.com";
    const superAdminPassword =
      process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@123";

    // Check if any super admin already exists (by role or email)
    const existingSuperAdmin = await User.findOne({
      $or: [{ role: Role.SUPER_ADMIN }, { email: superAdminEmail }],
    });

    if (existingSuperAdmin) {
      logger.info("Super Admin already exists. Skipping creation.");
      return;
    }

    // Only proceed to create if no super admin exists
    const authProvider: IAuthProvider = {
      provider: "credentials",
      providerId: superAdminEmail,
    };

    const payload: Partial<IUser> = {
      name: "Super Admin",
      email: superAdminEmail,
      password: superAdminPassword, // Will be hashed by User model pre-save hook
      role: Role.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      isVerified: true,
      auths: [authProvider],
    };

    const superAdmin = await User.create(payload);

    logger.info("✅ Super Admin created successfully", {
      email: superAdmin.email,
      role: superAdmin.role,
    });
  } catch (error) {
    logger.error("❌ Error seeding Super Admin:", error);
    // Don't throw error to prevent server startup failure
  }
};
