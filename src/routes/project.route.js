import express from "express";
import createProject from "../controller/project/createProject.js";
import getAllProjects from "../controller/project/getAllProjects.js";
import getSingleProjectDetails from "../controller/project/getSingleProjectDetails.js";
import authMiddleware from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", authMiddleware, getAllProjects);
router.post("/create", createProject);
router.get("/:projectId", getSingleProjectDetails);

export default router;
