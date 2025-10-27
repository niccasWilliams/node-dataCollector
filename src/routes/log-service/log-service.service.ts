import { database } from "@/db";
import { AppLogLevel, appLogs } from "@/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { createTransaction, nowInBerlin } from "@/util/utils";



class LogService {
  private db;

  constructor() {
    this.db = database;
  }


  private async log(level: AppLogLevel, message: string, context: Record<string, any> = {}) {
    try {
      await this.db.insert(appLogs).values({
        level,
        message,
        context,
        createdAt: nowInBerlin(),
      });
    } catch (err) {
      console.error("❌ Failed to insert log into DB:", err);
    }
  }

  async info(message: string, context: Record<string, any> = {}) {
    return this.log("info", message, context);
  }

  async warn(message: string, context: Record<string, any> = {}) {
    return this.log("warn", message, context);
  }

  async error(message: string, context: Record<string, any> = {}) {
    return this.log("error", message, context);
  }

  async critical(message: string, context: Record<string, any> = {}) {
    return this.log("critical", message, context);
  }



  async getLogs(limit: number = 100) {
    try {
      const logs = await this.db
        .select()
        .from(appLogs)
        .orderBy(desc(appLogs.createdAt))
        .limit(limit);
      return logs;
    } catch (err) {
      console.error("❌ Failed to fetch logs from DB:", err);
      return [];
    }
  }


  async deleteLog(logId: number) {
    try {
      const result = await this.db
        .delete(appLogs)
        .where(eq(appLogs.id, logId));
      return result;
    } catch (err) {
      console.error("❌ Failed to delete log from DB:", err);
      throw new Error("Failed to delete log");
    }
  }

  async deleteLogs(logIds: number[]) {
    if (!logIds || logIds.length === 0) throw new Error("No log IDs provided for deletion");
    try {
      const result = await createTransaction(async (trx) => {
        return await trx
          .delete(appLogs)
          .where(inArray(appLogs.id, logIds));
      });

      return result;
    } catch (err) {
      console.error("❌ Failed to delete logs from DB:", err);
      throw new Error("Failed to delete logs");
    }
  }


}

export const logService = new LogService();