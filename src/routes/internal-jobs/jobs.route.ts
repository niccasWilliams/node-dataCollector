import express, { Router } from "express";
import { AccessControl } from "@/routes/middleware";
import { internalJobsController } from "./jobs.controller";



//  AccessControl.isJob


const router: Router = express.Router();



    router.post("/internal",AccessControl.isJob, internalJobsController.cronJobHandler)
    router.get("/internal", internalJobsController.cronJobInfo)



export default router;
