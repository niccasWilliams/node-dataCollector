// INDIVIDUAL APP SETTINGS
// This file is NOT synced with the template
// Add your app-specific settings here

import { AppSettingsType } from "@/db/schema";
import fs from 'fs';
import path from 'path';

// Load app name from setup config if available
function getDefaultAppName(): string {
    try {
        const setupConfigPath = path.join(process.cwd(), '.setup-config.json');
        if (fs.existsSync(setupConfigPath)) {
            const config = JSON.parse(fs.readFileSync(setupConfigPath, 'utf-8'));
            return config.appNamePascal || config.appName || "My App";
        }
    } catch (error) {
        console.warn('⚠️  Could not load .setup-config.json, using default app name');
    }
    return "My App";
}

export const enum AppSettingsKey {
    ApplicationName = "application_name",
    // Add more settings here:
    // ApiKey = "api_key",
    // MaxUploadSize = "max_upload_size",
}

export type AppSettingsTypeMap = {
    [AppSettingsKey.ApplicationName]: string;
    // Add more type mappings here:
    // [AppSettingsKey.ApiKey]: string;
    // [AppSettingsKey.MaxUploadSize]: number;
};

export const defaultAppSettings: {
    key: AppSettingsKey;
    value: string;
    type: AppSettingsType;
    description?: string;
}[] = [
        {
            key: AppSettingsKey.ApplicationName,
            value: getDefaultAppName(),
            type: "string",
            description: "Name der Anwendung, wird in emails und Rechnungen verwendet",
        },
        // Add more settings here:
        // {
        //     key: AppSettingsKey.ApiKey,
        //     value: "",
        //     type: "string",
        //     description: "API Key für externe Services",
        // },
    ];
