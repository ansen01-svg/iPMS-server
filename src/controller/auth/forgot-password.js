import crypto from "crypto";
import User from "../../models/user.model.js";
import { sendOTPEmail } from "../../utils/mailSender.js"; // use named import

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
      <h2>Password Reset Request</h2>
      <p>Hello ${user.fullName || "User"},</p>
      <p>You requested to reset your password. Click the link below to reset it:</p>
      <a href="${resetUrl}" target="_blank">${resetUrl}</a>
      <p><b>Note:</b> This link will expire in 1 hour.</p>
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
