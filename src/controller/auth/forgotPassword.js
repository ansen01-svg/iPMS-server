// controller/auth/forgotPassword.js
import OTP from "../../models/otp.model.js";
import User from "../../models/user.model.js";
// import sendEmail  from "../../utils/mailSender.js"; // your mail sender

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Save OTP in DB
    await OTP.create({ email, otp });

    // Send OTP via email
    // await sendEmail(email, "Password Reset OTP", `Your OTP is: ${otp}`);

    res.status(200).json({
      success: true,
      message: "OTP sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export default forgotPassword;
