import express from "express";
import login from "../controller/auth/login.js";
import logout from "../controller/auth/logout.js";
import resendOTP from "../controller/auth/resend-otp.js";
import verifyOTP from "../controller/auth/verifyotp.js";

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);
router.post("/verify-otp", verifyOTP);
router.post("/resend-otp", resendOTP);

export default router;
