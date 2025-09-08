import mongoose from "mongoose";
import { sendOTPEmail } from "../utils/mailSender.js";

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true },
  otp: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, expires: 5 * 60 }, // auto-delete after 5 mins
});

// Pre-save hook to send email
otpSchema.pre("save", async function (next) {
  if (this.isNew) {
    try {
      await sendOTPEmail(
        this.email,
        "Your OTP for Login",
        `<h1>Verification OTP</h1><p>Your OTP code is:  <b>${this.otp}</b></p>`
      );
      console.log("OTP email sent successfully");
    } catch (error) {
      console.error("Error sending OTP email:", error);
    }
  }
  next();
});

const OTP = mongoose.model("OTP", otpSchema);
export default OTP;
