import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import User from "../../models/user.model.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const login = async (req, res) => {
  try {
    const { userId, password } = req.body;

    // Input validation
    if (!userId || !password) {
      return res.status(400).json({
        success: false,
        message: "User ID and password are required",
      });
    }

    // Find user by userId
    const user = await User.findOne({ userId: userId.trim() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Create JWT payload
    const payload = {
      id: user._id,
      userId: user.userId,
      role: user.designation,
      email: user.email,
      name: user.fullName || "Incomplete User",
      departmentId: user.departmentId,
    };

    // Sign JWT token
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    // Set token in cookie
    // res.cookie("token", token, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === "production",
    //   sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
    //   domain: process.env.NODE_ENV === "production" ? ".aptdcl.in" : undefined,
    //   maxAge: 3600000, // 1 hour
    // });

    // Determine message and requirePasswordChange based on first login status
    const message = user.isFirstLogin
      ? "First login - Please change your password"
      : "Login successful";

    // Method 1: Standard cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    // Method 2: More restrictive
    res.cookie("backup-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict", // More restrictive
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    // Method 3: Base64 encoded - Helps with encoding issues
    const encodedToken = Buffer.from(token).toString("base64");
    res.cookie("encoded-token", encodedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.status(200).json({
      success: true,
      message: message,
      requirePasswordChange: user.isFirstLogin,
      token: token,
      user: {
        id: user._id,
        userId: user.userId,
        fullName: user.fullName,
        username: user.username,
        email: user.email,
        role: user.designation,
        departmentName: user.departmentName,
        officeLocation: user.officeLocation,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export default login;
