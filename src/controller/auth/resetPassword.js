import bcrypt from "bcryptjs";
import OTP from "../../models/otp.model.js";
import User from "../../models/user.model.js";

const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Email, OTP and new password are required",
        });
    }

    // Check OTP
    const validOtp = await OTP.findOne({ email, otp });
    if (!validOtp) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    // Delete OTP after use
    await OTP.deleteOne({ _id: validOtp._id });

    return res.status(200).json({
      success: true,
      message:
        "Password reset successful. Please login with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export default resetPassword;
