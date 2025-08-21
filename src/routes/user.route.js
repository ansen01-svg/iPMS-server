import express from "express";
import createUser from "../controller/user/createUser.js";
import getAllUsers from "../controller/user/getAllUsers.js";
import { requireAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", requireAdmin(), getAllUsers);
router.post("/create", requireAdmin(), createUser);

export default router;
