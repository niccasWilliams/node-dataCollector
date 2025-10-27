export type JobUrgency = "low" | "medium" | "high" | "critical";
export type SerializedJob = Pick<CronJob, "id" | "name" | "description" | "schedule" | "urgency">;


export interface CronJob {
  id: string;
  name: string;
  description?: string;
  schedule: string;
  urgency: JobUrgency;
  handler: () => Promise<void>;
}