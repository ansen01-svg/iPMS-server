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
        `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OTP Verification</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #279eab; margin: 0; font-size: 28px;">iPMS</h1>
          <p style="color: #666666; margin: 5px 0 0 0; font-size: 14px;">Integrated Project Monitoring System</p>
        </div>

        <!-- Title -->
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="color: #333333; margin: 0 0 10px 0;">Login Verification</h2>
          <p style="color: #666666; margin: 0; font-size: 16px;">Please use the code below to complete your login</p>
        </div>

        <!-- OTP Box -->
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 30px;">
          <p style="color: #333333; margin: 0 0 15px 0; font-size: 16px;">Your OTP code is:</p>
          <div style="font-size: 32px; font-weight: bold; color: #279eab; letter-spacing: 8px; margin: 10px 0;">
            ${this.otp}
          </div>
          <p style="color: #666666; margin: 15px 0 0 0; font-size: 14px;">This code will expire in 10 minutes</p>
        </div>

        <!-- Security Warning -->
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin-bottom: 20px;">
          <p style="color: #856404; margin: 0; font-size: 14px;">
            <strong>Security Note:</strong> Do not share this OTP with anyone. iPMS will never ask for your OTP via phone or email.
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: #666666; font-size: 12px; border-top: 1px solid #eeeeee; padding-top: 20px;">
          <p style="margin: 0;">If you didn't request this OTP, please ignore this email or contact your administrator.</p>
          <p style="margin: 10px 0 0 0;">&copy; 2025 iPMS - Government Project Monitoring System. All rights reserved.</p>
        </div>

      </div>
    </body>
  </html>
  `
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
