import express from "express";
import createProject from "../controller/project/create-project.js";
import getAllProjects from "../controller/project/get-all-projects.js";
import getProjectDropdownOptions from "../controller/project/get-dropdown-options.js";
import getSingleProjectDetails from "../controller/project/get-single-project-details.js";
import { requireJe, requireLogin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", requireLogin(), getAllProjects);
router.post("/", requireJe(), createProject);
router.get("/dropdown-options", requireJe(), getProjectDropdownOptions);
router.get("/:projectId", requireLogin(), getSingleProjectDetails);

export default router;
