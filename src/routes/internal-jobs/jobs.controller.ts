import { Request, Response } from "express";
import { jobService } from "@/routes/internal-jobs/job.service";
import { logService } from "@/routes/log-service/log-service.service";
import z from "zod";
import { nowInBerlin } from "@/util/utils";



const jobExecutionSchema = z.object({
  jobId: z.string().min(1, "jobId is required"),
});


class InternalJobsController {

  async cronJobHandler(req: Request, res: Response) {
    const jobName = req.body.id as string;



    try {
      await jobService.runJobByName(jobName);
      return res.status(200).json({ message: "Job executed successfully" });
    } catch (err: any) {
      console.error(`❌ Error executing job "${jobName}":`, err);
      await logService.error(`Error executing job "${jobName}"`, {
        error: err.message,
        jobName,
        stack: err.stack,
      });
      return res.status(500).json({ error: "Job failed", details: err });
    }
  }


  async cronJobInfo(req: Request, res: Response) {
    try {
      const jobs = await jobService.getAllJobs();
      return res.status(200).json({
        success: true,
        data: jobs,
        count: jobs.length,
        generatedAt: nowInBerlin().toISOString()
      });

    } catch (err: any) {
      throw err;
    }
  }

}

export const internalJobsController = new InternalJobsController();

