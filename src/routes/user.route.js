import express from "express";
import createUser from "../controller/user/create-user.js";
import getAllUsers from "../controller/user/get-all-users.js";
import { requireAdmin } from "../middlewares/auth.middleware.js";

const router = express.Router();

router.get("/", requireAdmin(), getAllUsers);
router.post("/", requireAdmin(), createUser);

export default router;
