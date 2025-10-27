
import { CronJob } from "@/routes/internal-jobs/job.types";
import { emptyJob } from "./jobs/emptyJob";



export const cronJobRegistry: CronJob[] = [
    emptyJob(),
];