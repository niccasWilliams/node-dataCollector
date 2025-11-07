/**
 * UserDataService - Persistent Browser Profiles (DB-backed)
 *
 * Manages persistent user data directories for browser sessions.
 * Allows staying logged in across sessions (like a real user!).
 *
 * Key features:
 * - Persistent cookies/localStorage (filesystem)
 * - Profile metadata in PostgreSQL database
 * - Consistent fingerprint seeds
 * - Automatic cleanup of old profiles
 */

import path from 'path';
import fs from 'fs';
import os from 'os';
import { logger } from '@/utils/logger';
import { database } from '@/db';
import { eq, sql } from 'drizzle-orm';
import { BrowserProfile, browserProfiles } from '@/db/individual/individual-schema';

export interface UserDataProfile {
  id: number;
  name: string;
  path: string;
  createdAt: Date;
  lastUsedAt: Date;
  website?: string;
  fingerprintSeed: number;
  userId?: number;
  description?: string;
}

export class UserDataService {
  private baseDir: string;
  private profiles: Map<string, UserDataProfile> = new Map(); // Cache

  constructor(baseDir?: string) {
    // Use persistent directory (NOT /tmp!)
    this.baseDir = baseDir || path.join(os.homedir(), '.node-datacollector', 'browser-profiles');
    this.ensureBaseDir();
  }

  /**
   * Ensure base directory exists
   */
  private ensureBaseDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
      logger.info(`[UserData] Created base directory: ${this.baseDir}`);
    }
  }

  /**
   * Convert DB profile to UserDataProfile
   */
  private toUserDataProfile(dbProfile: BrowserProfile): UserDataProfile {
    return {
      id: dbProfile.id,
      name: dbProfile.name,
      path: dbProfile.userDataPath,
      createdAt: dbProfile.createdAt,
      lastUsedAt: dbProfile.lastUsedAt,
      website: dbProfile.website || undefined,
      fingerprintSeed: dbProfile.fingerprintSeed,
      userId: dbProfile.userId || undefined,
      description: dbProfile.description || undefined,
    };
  }

  /**
   * Get or create profile for a website
   */
  async getOrCreateProfile(website: string, userId?: number): Promise<UserDataProfile> {
    // Sanitize website name for filesystem
    const safeName = this.sanitizeWebsiteName(website);

    // Check cache first
    let profile = this.profiles.get(safeName);
    if (profile) {
      // Update last used in DB (async, don't wait)
      this.updateLastUsed(profile.id).catch((error) => {
        logger.warn(`[UserData] Failed to update lastUsedAt for ${safeName}:`, error);
      });

      logger.info(`[UserData] Using existing profile: ${safeName} (cached)`);
      logger.info(`[UserData] 🎭 Fingerprint seed: ${profile.fingerprintSeed} (consistent!)`);
      return profile;
    }

    // Check database
    try {
      const dbProfiles = await database
        .select()
        .from(browserProfiles)
        .where(eq(browserProfiles.name, safeName))
        .limit(1);

      if (dbProfiles.length > 0) {
        const dbProfile = dbProfiles[0];
        profile = this.toUserDataProfile(dbProfile);

        // Cache it
        this.profiles.set(safeName, profile);

        // Update last used in DB (async, don't wait)
        this.updateLastUsed(profile.id).catch((error) => {
          logger.warn(`[UserData] Failed to update lastUsedAt for ${safeName}:`, error);
        });

        logger.info(`[UserData] Using existing profile: ${safeName} (from DB)`);
        logger.info(`[UserData] 🎭 Fingerprint seed: ${profile.fingerprintSeed} (consistent!)`);
        return profile;
      }
    } catch (error) {
      logger.error(`[UserData] Error loading profile from DB:`, error);
      throw error;
    }

    // Create new profile
    const profilePath = path.join(this.baseDir, safeName);

    if (!fs.existsSync(profilePath)) {
      fs.mkdirSync(profilePath, { recursive: true });
    }

    // Generate consistent fingerprint seed
    const fingerprintSeed = Math.floor(Math.random() * 1000000);
    const now = new Date();

    try {
      const inserted = await database
        .insert(browserProfiles)
        .values({
          name: safeName,
          website,
          fingerprintSeed,
          userDataPath: profilePath,
          userId: userId || null,
          createdAt: now,
          lastUsedAt: now,
          updatedAt: now,
        })
        .returning();

      profile = this.toUserDataProfile(inserted[0]);

      // Cache it
      this.profiles.set(safeName, profile);

      logger.info(`[UserData] ✅ Created new profile: ${safeName} at ${profilePath}`);
      logger.info(`[UserData] 🎭 Generated fingerprint seed: ${fingerprintSeed}`);

      return profile;
    } catch (error) {
      logger.error(`[UserData] Error creating profile in DB:`, error);
      throw error;
    }
  }

  /**
   * Update lastUsedAt timestamp
   */
  private async updateLastUsed(profileId: number): Promise<void> {
    await database
      .update(browserProfiles)
      .set({
        lastUsedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(browserProfiles.id, profileId));
  }

  /**
   * Get profile by name
   */
  async getProfile(name: string): Promise<UserDataProfile | null> {
    // Check cache first
    let profile = this.profiles.get(name);
    if (profile) {
      return profile;
    }

    // Check database
    try {
      const dbProfiles = await database
        .select()
        .from(browserProfiles)
        .where(eq(browserProfiles.name, name))
        .limit(1);

      if (dbProfiles.length > 0) {
        profile = this.toUserDataProfile(dbProfiles[0]);
        this.profiles.set(name, profile); // Cache it
        return profile;
      }

      return null;
    } catch (error) {
      logger.error(`[UserData] Error loading profile from DB:`, error);
      throw error;
    }
  }

  /**
   * Get all profiles
   */
  async getAllProfiles(): Promise<UserDataProfile[]> {
    try {
      const dbProfiles = await database.select().from(browserProfiles);
      const profiles = dbProfiles.map((dbProfile) => this.toUserDataProfile(dbProfile));

      // Update cache
      profiles.forEach((profile) => {
        this.profiles.set(profile.name, profile);
      });

      return profiles;
    } catch (error) {
      logger.error(`[UserData] Error loading profiles from DB:`, error);
      throw error;
    }
  }

  /**
   * Delete profile (careful!)
   */
  async deleteProfile(name: string): Promise<boolean> {
    try {
      // Get profile first
      const profile = await this.getProfile(name);
      if (!profile) {
        logger.warn(`[UserData] Profile not found: ${name}`);
        return false;
      }

      // Delete from database
      await database.delete(browserProfiles).where(eq(browserProfiles.id, profile.id));

      // Delete directory
      if (fs.existsSync(profile.path)) {
        fs.rmSync(profile.path, { recursive: true, force: true });
      }

      // Remove from cache
      this.profiles.delete(name);

      logger.info(`[UserData] ✅ Deleted profile: ${name}`);
      return true;
    } catch (error) {
      logger.error(`[UserData] Error deleting profile ${name}:`, error);
      return false;
    }
  }

  /**
   * Clean up old profiles (not used in X days)
   */
  async cleanupOldProfiles(daysOld: number = 30): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    try {
      // Get old profiles from DB
      const oldProfiles = await database
        .select()
        .from(browserProfiles)
        .where(sql`${browserProfiles.lastUsedAt} < ${cutoffDate.toISOString()}`);

      let deleted = 0;

      for (const dbProfile of oldProfiles) {
        const profile = this.toUserDataProfile(dbProfile);
        logger.info(
          `[UserData] Cleaning up old profile: ${profile.name} (last used: ${profile.lastUsedAt.toISOString()})`
        );

        if (await this.deleteProfile(profile.name)) {
          deleted++;
        }
      }

      logger.info(`[UserData] Cleaned up ${deleted} old profile(s)`);
      return deleted;
    } catch (error) {
      logger.error(`[UserData] Error cleaning up old profiles:`, error);
      throw error;
    }
  }

  /**
   * Sanitize website name for filesystem
   */
  private sanitizeWebsiteName(website: string): string {
    // Remove protocol
    let safe = website.replace(/^https?:\/\//, '');

    // Remove www.
    safe = safe.replace(/^www\./, '');

    // Replace invalid characters
    safe = safe.replace(/[^a-zA-Z0-9.-]/g, '_');

    // Remove trailing slashes
    safe = safe.replace(/\/+$/, '');

    return safe;
  }

  /**
   * Get base directory
   */
  getBaseDir(): string {
    return this.baseDir;
  }
}

// Export singleton
export const userDataService = new UserDataService();
