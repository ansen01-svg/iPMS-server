import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import NewUser from "../../models/user.model.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
console.log(JWT_SECRET);

const login = async (req, res) => {
  const { userId, password } = req.body;
  console.log("Login API hit");

  try {
    // Find user by userId
    const user = await NewUser.findOne({ userId });
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });

    if (user.isFirstLogin) {
      return res.status(200).json({
        success: true,
        message: "First login - Please change your password",
        requirePasswordChange: true,
        userId: user._id,
      });
    }

    // Create JWT payload
    const payload = {
      id: user._id,
      userId: user.userId,
      role: user.designation,
      email: user.email,
      name: user.name || user.username, // use name if available
    };

    // Sign JWT token
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    // Set token in cookie
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      domain: process.env.NODE_ENV === "production" ? ".aptdcl.in" : undefined,
      maxAge: 3600000,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      requirePasswordChange: false,
      token: ` ${token}`,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.designation,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default login;
