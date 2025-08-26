import express from "express";
import createArchiveProject from "../controller/archive-project.js/create-archive-project.js";
import getAllArchiveProjects from "../controller/archive-project.js/get-all-archive-projects.js";
import getFilterOptions from "../controller/archive-project.js/get-filter-options.js";
import { getArchiveProjectById } from "../controller/archive-project.js/get-single-archive-project.js";
import { requireJe, requireLogin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", requireLogin(), getAllArchiveProjects);
router.post("/", requireJe(), createArchiveProject);
router.get("/filter-options", requireLogin(), getFilterOptions);
router.get("/:id", requireLogin(), getArchiveProjectById);

export default router;
