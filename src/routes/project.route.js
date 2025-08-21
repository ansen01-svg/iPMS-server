import express from "express";
import createProject from "../controller/project/createProject.js";
import getAllProjects from "../controller/project/getAllProjects.js";
import getSingleProjectDetails from "../controller/project/getSingleProjectDetails.js";
import { requireJe, requireLogin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", requireLogin(), getAllProjects);
router.post("/create", requireJe(), createProject);
router.get("/:projectId", requireLogin(), getSingleProjectDetails);

export default router;
