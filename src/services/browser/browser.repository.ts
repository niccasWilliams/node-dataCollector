import { database } from '@/db';
import {
  browserActivities,
  browserSessions,
  type BrowserActivityType,
} from '@/db/individual/individual-schema';
import type { BrowserSession, BrowserConfig } from '@/types/browser.types';
import { desc, eq } from 'drizzle-orm';

type UpsertSessionParams = {
  session: BrowserSession;
  config?: Partial<BrowserConfig>;
  metadata?: Record<string, unknown> | null;
};

export async function upsertBrowserSession({
  session,
  config,
  metadata,
}: UpsertSessionParams): Promise<void> {
  const insertValues = {
    sessionId: session.id,
    status: session.status,
    currentUrl: session.currentUrl,
    title: session.title,
    config: config ?? {},
    metadata: metadata ?? {},
    createdAt: session.createdAt,
    lastActivityAt: session.lastActivityAt,
    closedAt: session.status === 'closed' ? session.lastActivityAt : null,
  };

  const updateSet: Record<string, unknown> = {
    status: session.status,
    currentUrl: session.currentUrl,
    title: session.title,
    lastActivityAt: session.lastActivityAt,
    closedAt: session.status === 'closed' ? session.lastActivityAt : null,
  };

  await database
    .insert(browserSessions)
    .values(insertValues)
    .onConflictDoUpdate({
      target: browserSessions.sessionId,
      set: updateSet,
    });
}

type ActivityParams = {
  sessionId: string;
  type: BrowserActivityType;
  action: string;
  target?: string | null;
  value?: string | null;
  metadata?: Record<string, unknown> | null;
  success?: boolean;
  error?: string | null;
  duration?: number | null;
  timestamp?: Date;
};

export async function recordBrowserActivity({
  sessionId,
  type,
  action,
  target,
  value,
  metadata,
  success = true,
  error,
  duration,
  timestamp,
}: ActivityParams): Promise<void> {
  const activityTimestamp = timestamp ?? new Date();

  await database.insert(browserActivities).values({
    sessionId,
    type,
    action,
    target: target ?? null,
    value: value ?? null,
    metadata: metadata ?? {},
    success,
    error: error ?? null,
    duration: duration ?? null,
    timestamp: activityTimestamp,
  });
}

export async function fetchSessionHistory(limit = 50) {
  const normalizedLimit = Math.min(Math.max(limit, 1), 200);

  return await database
    .select()
    .from(browserSessions)
    .orderBy(desc(browserSessions.createdAt))
    .limit(normalizedLimit);
}

export async function removeSessionHistoryEntry(sessionId: string) {
  await database
    .delete(browserSessions)
    .where(eq(browserSessions.sessionId, sessionId));
}
