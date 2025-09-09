import bcrypt from "bcryptjs";
import crypto from "crypto";
import dotenv from "dotenv";
import OTP from "../../models/otp.model.js";
import User from "../../models/user.model.js";

dotenv.config();

const login = async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res
        .status(400)
        .json({ success: false, message: "User ID and password are required" });
    }

    const user = await User.findOne({ userId: userId.trim() });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    //  Generate OTP (6-digit random number)
    const otp = crypto.randomInt(100000, 999999).toString();

    //  Save OTP to DB (expires in 5 min)
    await OTP.create({ email: user.email, otp });

    return res.status(200).json({
      success: true,
      message: "OTP sent to your email. Please verify to complete login.",
      email: user.email, // you may hide this in production
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export default login;
