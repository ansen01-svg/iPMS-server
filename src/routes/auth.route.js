import express from "express";
import login from "../controller/auth/login.js";
import logout from "../controller/auth/logout.js";
// import { sendOTP } from "../controller/auth/otpsend.js";
import verifyOTP from "../controller/auth/verifyotp.js";

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);
// router.post("/sendotp", sendOTP);
router.post("/verifyotp", verifyOTP);

export default router;
