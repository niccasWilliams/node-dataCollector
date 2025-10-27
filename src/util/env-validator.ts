// Environment Variable Validation
// Validates required environment variables on startup

const requiredEnvVars = [
    "DATABASE_URL",
    "FRONTEND_API_KEY",
    "NODE_PORT",
    "HOST_NAME",
] as const;

const optionalEnvVars = [
    "BACKEND_TO_BACKEND_API_KEY",
    "CRON_JOB_SECRET",
    "PUBLIC_URL",
    "FRONTEND_HOST_NAME",
] as const;

export function validateEnvironmentVariables(): void {
    const missing: string[] = [];
    const warnings: string[] = [];

    // Check required vars
    for (const varName of requiredEnvVars) {
        if (!process.env[varName]) {
            missing.push(varName);
        }
    }

    // Check optional vars (warnings only)
    for (const varName of optionalEnvVars) {
        if (!process.env[varName]) {
            warnings.push(varName);
        }
    }

    // Report missing required vars
    if (missing.length > 0) {
        console.error("❌ Missing required environment variables:");
        missing.forEach(v => console.error(`   - ${v}`));
        throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
    }

    // Report warnings for optional vars
    if (warnings.length > 0 && process.env.NODE_ENV === "production") {
        console.warn("⚠️  Missing optional environment variables (may cause issues):");
        warnings.forEach(v => console.warn(`   - ${v}`));
    }

    console.log("✅ Environment variables validated successfully");
}
