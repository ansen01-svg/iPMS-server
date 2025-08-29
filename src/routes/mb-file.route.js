import express from "express";
import serveFile from "../controller/mb/serve-file.js";

const router = express.Router();

// Serve uploaded files
router.get("/:fileName", serveFile);

export default router;
