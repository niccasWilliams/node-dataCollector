import { database } from "@/db";
import { appSettings, AppSettings } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import {  nowInBerlin } from "@/util/utils";
import { AppSettingsKey, AppSettingsTypeMap, defaultAppSettings } from "./individual-settings";







class SettingsService {


    private db;

    constructor() {
        this.db = database;
    }

    private ensureAppSettingsKey(key: string): AppSettingsKey {
        if (key === "main_variant_id" || key === "application_name") {
            return key as AppSettingsKey;
        }
        throw new Error(`Invalid app setting key: ${key}`);
    }





    private async createAppSetting(settings: Partial<AppSettings>): Promise<AppSettings> {
        try {

            if (!settings.key || !settings.value || !settings.type) throw new Error("Key, value and type are required to create an app setting");

            const currentSetting = await this.getAppSettingByKey(this.ensureAppSettingsKey(settings.key));
            if (currentSetting) throw new Error(`App setting with key ${settings.key} already exists, please change the key`);
            const newSettings: AppSettings = {
                key: settings.key,
                value: settings.value,
                type: settings.type,
                description: settings.description,
                createdAt: nowInBerlin(),
            };

            const insertedSettings = await this.db.insert(appSettings).values(newSettings).returning();
            return insertedSettings[0];
        } catch (error) {
            console.error("❌ Error creating app settings:", error);
            throw error;
        }
    }

    private async getAppSettingByKey(key: AppSettingsKey): Promise<AppSettings | undefined> {
        try {
            const setting = await this.db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
            return setting[0];
        } catch (error) {
            console.error("❌ Error fetching app setting by key:", error);
            throw error;
        }
    }




    //PUBIC METHODs:
    async getTypedValue<K extends keyof AppSettingsTypeMap>(key: K): Promise<AppSettingsTypeMap[K]> {
        const setting = await this.getAppSettingByKey(key as AppSettingsKey);
        if (!setting) throw new Error(`Setting "${key}" not found`);

        switch (setting.type) {
            case "number":
                return Number(setting.value) as unknown as AppSettingsTypeMap[K];
            case "boolean":
                return (setting.value === "true") as unknown as AppSettingsTypeMap[K];
            case "json":
                return JSON.parse(setting.value) as AppSettingsTypeMap[K];
            case "string":
            default:
                return setting.value as AppSettingsTypeMap[K];
        }
    }


    async updateAppSetting(settingsId: number, key: AppSettingsKey, value: string | number | boolean | object): Promise<AppSettings> {
        try {
            const stringifiedValue = typeof value === "string"
                ? value
                : typeof value === "object"
                    ? JSON.stringify(value)
                    : value.toString();

            const updatedSetting = await this.db
                .update(appSettings)
                .set({ value: stringifiedValue })
                .where(eq(appSettings.key, key))
                .returning();

            return updatedSetting[0];
        } catch (error) {
            console.error("❌ Error updating app setting:", error);
            throw error;
        }
    }



    async ensureAppSettingsExist() {
        for (const setting of defaultAppSettings) {
            const existing = await settingsService.getAppSettingByKey(setting.key);
            if (!existing) {
                await settingsService.createAppSetting(setting);
                console.log(`✅ AppSetting "${setting.key}" wurde angelegt.`);
            }
        }
    }


    async getAll(): Promise<AppSettings[]> {
        try {
            const settings = await this.db
                .select()
                .from(appSettings)
                .orderBy(asc(appSettings.createdAt)); // sortiere aufsteigend nach createdAt
            return settings;
        } catch (error) {
            console.error("❌ Error fetching all app settings:", error);
            throw error;
        }
    }


}

export const settingsService = new SettingsService();