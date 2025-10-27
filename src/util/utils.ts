import crypto from "crypto";
import { DateTime } from "luxon";
import { APP_TIME_ZONE } from "../app.config";
import { database } from "../db";
import { Request, Response } from "express";
import { FileData, Languages } from "@/types/types";
import { v4 as uuidv4 } from "uuid";
import { userService } from "@/routes/auth/users/user/user.service";




export function nowInBerlin() {
  return DateTime.now().setZone(APP_TIME_ZONE).toJSDate();
}

export function parseToBerlinDate(
  isoString: string,
  originalZone: string = "utc"
): Date {
  console.log(`Parsing date: ${isoString} from zone: ${originalZone}`);

  const result = DateTime.fromISO(isoString, { zone: originalZone })
    .setZone(APP_TIME_ZONE)
    .toJSDate();

  console.log(`Parsed date in Berlin time zone: ${result.toISOString()}`);
  return result;
}

export function dateInBerlin(day: number, month: number, year: number, hour: number = 0, minute: number = 0): Date {
  return DateTime.fromObject(
    {
      day,
      month,
      year,
      hour,
      minute,
    },
    { zone: APP_TIME_ZONE }
  ).toJSDate();
}



export function addHours(date: Date, hours: number): Date {
  const newDate = new Date(date);
  newDate.setHours(newDate.getHours() + hours);
  return newDate;
}

export function addMinutes(date: Date, minutes: number): Date {
  const newDate = new Date(date);
  newDate.setMinutes(newDate.getMinutes() + minutes);
  return newDate;
}

export function createUUID() {
  return uuidv4();
}

export function getLanguageFromRequest(req: Request): Languages {
  const language = req.headers["language"] as Languages;
  return language;
}

export function getExternalUserIdFromRequest(req: Request): number | undefined {
  const externalUserId = req.headers["user-id"];
  if (typeof externalUserId === "string") {
    const parsedId = parseInt(externalUserId, 10);
    if (!isNaN(parsedId)) {
      return parsedId;
    }
  } else if (typeof externalUserId === "number") {
    return externalUserId;
  }
  return undefined;
}

export async function getUserIdFromRequest(req: Request): Promise<number | undefined> {
  const externalUserId = req.headers["user-id"];

  if (typeof externalUserId !== "string") {
    return undefined;
  }

  const parsedExternalUserId = parseInt(externalUserId, 10);
  if (isNaN(parsedExternalUserId)) {
    return undefined;
  }
  const user = await userService.getUserByExternalUserId(parsedExternalUserId);
  return user?.id;
}




export async function getFileDataFromRequest(req: Request): Promise<FileData[] | undefined> {
  const body: any = (req as any).body ?? {};

  // --- Neues Mehrfach-Format ---
  if (Array.isArray(body.files) && body.files.length > 0) {
    const result: FileData[] = [];
    for (const f of body.files) {
      const base64String = f?.base64String;
      const fileName = f?.fileName;
      // akzeptiere sowohl mimeType als auch mimeTyp (Tippfehler abfangen)
      const mimeType = f?.mimeType ?? f?.mimeTyp;
      const size = f?.size;
      const field = f?.field;

      if (!base64String || !fileName || !mimeType) continue;

      try {
        const fileBuffer = Buffer.from(base64String, "base64");
        result.push({ fileBuffer, fileName, mimeType, size, field });
      } catch (e) {
        console.error("Error decoding base64 (files[] item):", e);
      }
    }
    return result.length ? result : undefined;
  }

  // --- Legacy Single-Format ---
  const base64String = body?.base64String;
  const fileName = body?.fileName;
  const mimeType = body?.mimeType ?? body?.mimeTyp;
  const size = body?.size;

  if (base64String && fileName && mimeType) {
    try {
      const fileBuffer = Buffer.from(base64String, "base64");
      return [{ fileBuffer, fileName, mimeType, size }];
    } catch (e) {
      console.error("Error decoding base64 (legacy single):", e);
      return undefined;
    }
  }

  return undefined;
}


export function generateRandomId(param1: string | number, param2: string): string {
  //if you youse param1 as number and as a unique userId or smth (serial):

  //you can be sure, that there will be no chance of collision
  //as long as the param1 is unique 

  //(otherwise there must be tens of million requests in a millisecond)

  try {
    const param1Str = param1.toString();
    const firstChar = param1Str.charAt(0);

    const data = `${param1}-${param2}`;
    const hash = crypto.createHash("sha256").update(data).digest("hex");

    const now = new Date();
    const formattedDate = now
      .toISOString() // ISO-Format: "2025-01-12T14:45:30.000Z"
      .replace(/[-T:.Z]/g, "")
      .slice(0, 14);

    const hashPart = hash.slice(0, hash.length - formattedDate.length - 1);

    return `${firstChar}${hashPart}${formattedDate}`;
  } catch (error) {
    console.error("Fehler beim Generieren der ID:", error);
    throw new Error("Fehler beim Generieren der ID");
  }
}

export async function createTransaction<T>(
  cb: (trx: typeof database) => Promise<T>
): Promise<T> {
  return await database.transaction(async (trx) => {
    const result = await cb(trx);
    return result;
  });
}



export async function useOrCreateTransaction<T>(
  maybeTrx: typeof database | undefined,
  cb: (trx: typeof database) => Promise<T>
): Promise<T> {
  if (maybeTrx) {
    // externe Transaktion verwenden
    return cb(maybeTrx);
  }

  // eigene Transaktion starten
  return await database.transaction(async (trx) => {
    return await cb(trx);
  });
}




export type RetryOptions = {
  maxRetries: number;
  baseDelayMs?: number;
  backoffFactor?: number;
  maxTotalDurationMs?: number;
  fallback?: () => Promise<void>;
  name?: string; // Optional für Logging
};

export async function retryWithTimeoutControl<T>(
  task: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxRetries,
    baseDelayMs = 1000,
    backoffFactor = 1.5,
    maxTotalDurationMs = 10_000,
    fallback,
    name = "Task",
  } = options;

  const startTime = Date.now();

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const now = Date.now();
    const elapsed = now - startTime;

    try {
      const result = await task();
      console.log(`✅ ${name} succeeded on attempt ${attempt}`);
      return result;
    } catch (err: any) {
      const nextDelay = Math.floor(baseDelayMs * Math.pow(backoffFactor, attempt - 1));
      const estimatedNextTotal = elapsed + nextDelay + 500; // + buffer

      console.warn(`❌ ${name} attempt ${attempt} failed: ${err.message || err}`);

      if (attempt === maxRetries || estimatedNextTotal > maxTotalDurationMs) {
        console.error(`🛑 ${name} giving up after ${attempt} attempts`);

        if (fallback) {
          console.warn(`⚠️ Executing fallback for ${name}`);
          await fallback();
        }

        throw new Error(`${name} failed after ${attempt} attempts`);
      }

      console.log(`⏳ ${name} retrying in ${nextDelay}ms`);
      await new Promise(res => setTimeout(res, nextDelay));
    }
  }

  throw new Error(`${name} unexpectedly exited retry loop`);
}



export function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error("⏳ Operation timed out")), ms);
    promise.then(
      value => {
        clearTimeout(id);
        resolve(value);
      },
      err => {
        clearTimeout(id);
        reject(err);
      }
    );
  });
}




export function normalizeEmail(email: string): string {
  let normalized = email.trim().toLowerCase();

  // Google-Spezifische Behandlung
  if (normalized.endsWith("@googlemail.com")) {
    normalized = normalized.replace("@googlemail.com", "@gmail.com");
  }

  if (normalized.endsWith("@gmail.com")) {
    const [localPart, domainPart] = normalized.split("@");
    normalized = `${localPart.replace(/\./g, "")}@${domainPart}`;
  }

  // Microsoft-Spezifische Behandlung
  if (normalized.endsWith("@outlook.com") || normalized.endsWith("@hotmail.com") || normalized.endsWith("@live.com")) {
    normalized = normalized.toLowerCase();
  }

  // Yahoo
  if (normalized.endsWith("@yahoo.com")) {
    normalized = normalized.toLowerCase();
  }

  // ProtonMail
  if (normalized.endsWith("@protonmail.com")) {
    const [localPart, domainPart] = normalized.split("@");
    normalized = `${localPart.replace(/\./g, "")}@${domainPart}`;
  }

  // Standard für andere Domains
  return normalized;
}