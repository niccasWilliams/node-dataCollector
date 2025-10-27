import { SerializedJob } from "./job.types";
import { cronJobRegistry } from "./rob-registry";



class JobService {

  async runJobByName(name: string): Promise<void> {
    const job = cronJobRegistry.find((job) => job.name === name);
    if (!job) throw new Error(`🚫 Unknown job: ${name}`);

    console.log(`▶️ Running job: ${job.name} - ${job.description ?? ""}`);
    const start = Date.now();

    try {
      await job.handler();
      const duration = Date.now() - start;
      console.log(`✅ Finished job "${job.name}" in ${duration}ms`);
    } catch (err) {
      console.error(`❌ Job "${job.name}" failed:`, err);
      throw err;
    }
  }


  async getAllJobs(): Promise<SerializedJob[]> {
    return cronJobRegistry.map((job) => ({
      id: job.id,
      name: job.name,
      description: job.description,
      schedule: job.schedule,
      urgency: job.urgency,
    }));
  }

}

export const jobService = new JobService();