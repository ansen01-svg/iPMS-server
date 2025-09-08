import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import OTP from "../../models/otp.model.js";
import User from "../../models/user.model.js";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Email and OTP are required" });
    }

    //  Find OTP in DB
    const validOtp = await OTP.findOne({ email, otp });
    if (!validOtp) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired OTP" });
    }

    //  Delete OTP after successful use
    await OTP.deleteOne({ _id: validOtp._id });

    //  Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    //  Generate JWT
    const payload = {
      id: user._id,
      userId: user.userId,
      role: user.designation,
      email: user.email,
      name: user.fullName || "Incomplete User",
      departmentName: user.departmentName || "Unknown Department",
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    //  Method 1: Standard cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    //  Method 2: More restrictive
    res.cookie("backup-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    //  Method 3: Base64 encoded
    const encodedToken = Buffer.from(token).toString("base64");
    res.cookie("encoded-token", encodedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "OTP verified, login successful",
      token,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.fullName,
        email: user.email,
        role: user.designation,
        departmentName: user.departmentName,
      },
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export default verifyOtp;
