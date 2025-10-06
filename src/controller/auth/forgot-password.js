import crypto from "crypto";
import User from "../../models/user.model.js";
import { sendOTPEmail } from "../../utils/mailSender.js";

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found with this email",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpire = Date.now() + 60 * 60 * 1000; // 1 hour expiry
    // console.log("Generated reset token:", resetToken);

    // Save hashed token & expiry in DB
    user.resetPasswordToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    user.resetPasswordExpire = resetTokenExpire;
    await user.save({ validateBeforeSave: false });

    // Reset URL (your frontend should handle this link)
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?resetToken=${resetToken}`;
    // const resetUrl = `http://localhost:3000/reset-password?resetToken=${resetToken}`;

    // Email HTML template
    const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset Request</title>
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
          <h2 style="color: #333333; margin: 0 0 10px 0;">Password Reset Request</h2>
          <p style="color: #666666; margin: 0; font-size: 16px;">We received a request to reset your password</p>
        </div>

        <!-- Greeting -->
        <div style="margin-bottom: 20px;">
          <p style="color: #333333; margin: 0; font-size: 16px;">Hello <strong>${
            user.fullName || "User"
          }</strong>,</p>
        </div>

        <!-- Message -->
        <div style="margin-bottom: 30px;">
          <p style="color: #666666; margin: 0 0 15px 0; font-size: 15px; line-height: 1.6;">
            You requested to reset your password for your iPMS account. Click the button below to create a new password:
          </p>
        </div>

        <!-- Reset Button -->
        <div style="text-align: center; margin-bottom: 30px;">
          <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #279eab; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 5px; font-size: 16px; font-weight: bold;">
            Reset Password
          </a>
        </div>

        <!-- Alternative Link -->
        <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
          <p style="color: #666666; margin: 0 0 10px 0; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #279eab; margin: 0; font-size: 13px; word-break: break-all;">
            ${resetUrl}
          </p>
        </div>

        <!-- Expiration Warning -->
        <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin-bottom: 20px;">
          <p style="color: #856404; margin: 0; font-size: 14px;">
            <strong>⏰ Important:</strong> This password reset link will expire in 1 hour for security reasons.
          </p>
        </div>

        <!-- Security Note -->
        <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 15px; margin-bottom: 20px;">
          <p style="color: #721c24; margin: 0; font-size: 14px;">
            <strong>⚠️ Security Alert:</strong> If you didn't request a password reset, please ignore this email and ensure your account is secure. Your password will remain unchanged.
          </p>
        </div>

        <!-- Footer -->
        <div style="text-align: center; color: #666666; font-size: 12px; border-top: 1px solid #eeeeee; padding-top: 20px;">
          <p style="margin: 0;">This is an automated email. Please do not reply to this message.</p>
          <p style="margin: 10px 0 0 0;">&copy; 2025 iPMS - Government Project Monitoring System. All rights reserved.</p>
        </div>

      </div>
    </body>
  </html>
`;

    // Send email
    await sendOTPEmail(user.email, "Password Reset - APTDCL", html);

    res.status(200).json({
      success: true,
      message: "Password reset link has been sent to your email",
    });
  } catch (error) {
    console.error("Forgot Password Error:", error);

    res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
};

export default forgotPassword;
