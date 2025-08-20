import express from "express";
import login from "../controller/auth/login.js";
import logout from "../controller/auth/logout.js";

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);

export default router;
