import { logService } from "@/routes/log-service/log-service.service";
import { CronJob } from "../job.types";




// Eine Funktion, die einen CronJob zurückgibt
export const emptyJob = (): CronJob => {
  return {
    id: "emptyJob",
    name: "emptyJob",
    description: "An empty job that does nothing",
    schedule: "0 0 * * *", // Täglich um Mitternacht
    urgency: "low",
    handler: async () => {
      try {
        // Nichts tun
      } catch (error) {
        await logService.error("❌ Error in empty job", { error });
      }
    },
  };
};
