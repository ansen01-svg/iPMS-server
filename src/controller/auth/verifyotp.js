import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import OTP from "../../models/otp.model.js";
import User from "../../models/user.model.js";

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET;

// In-memory store for rate limiting (use Redis in production)
const verifyAttempts = new Map();
const VERIFY_COOLDOWN = 30000; // 30 seconds between failed attempts
const MAX_VERIFY_ATTEMPTS = 5; // Max 5 failed attempts per 15 minutes
const ATTEMPT_WINDOW = 15 * 60 * 1000; // 15 minutes
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes lockout after max attempts

// Rate limiting helper functions
const checkVerifyRateLimit = (email, clientIP = null) => {
  const now = Date.now();
  const key = email.toLowerCase().trim();
  const userAttempts = verifyAttempts.get(key) || {
    attempts: [],
    lastAttempt: 0,
    lockedUntil: 0,
    successfulVerification: false,
  };

  // Check if user is currently locked out
  if (userAttempts.lockedUntil > now) {
    const remainingLockout = Math.ceil(
      (userAttempts.lockedUntil - now) / 60000
    );
    return {
      allowed: false,
      error: `Account temporarily locked due to too many failed attempts. Try again in ${remainingLockout} minutes.`,
      remainingTime: remainingLockout,
      type: "lockout",
    };
  }

  // Check cooldown period between attempts
  if (now - userAttempts.lastAttempt < VERIFY_COOLDOWN) {
    const remainingTime = Math.ceil(
      (VERIFY_COOLDOWN - (now - userAttempts.lastAttempt)) / 1000
    );
    return {
      allowed: false,
      error: `Too many rapid attempts. Please wait ${remainingTime} seconds before trying again.`,
      remainingTime,
      type: "cooldown",
    };
  }

  // Clean old attempts (older than 15 minutes)
  userAttempts.attempts = userAttempts.attempts.filter(
    (attempt) => now - attempt.timestamp < ATTEMPT_WINDOW
  );

  // Check if max attempts reached in the time window
  if (userAttempts.attempts.length >= MAX_VERIFY_ATTEMPTS) {
    // Lock the account for 15 minutes
    userAttempts.lockedUntil = now + LOCKOUT_DURATION;
    verifyAttempts.set(key, userAttempts);

    return {
      allowed: false,
      error:
        "Too many failed verification attempts. Account locked for 15 minutes.",
      remainingTime: 15,
      type: "max_attempts",
    };
  }

  return {
    allowed: true,
    attemptsRemaining: MAX_VERIFY_ATTEMPTS - userAttempts.attempts.length,
  };
};

const recordFailedAttempt = (email, clientIP = null) => {
  const now = Date.now();
  const key = email.toLowerCase().trim();
  const userAttempts = verifyAttempts.get(key) || {
    attempts: [],
    lastAttempt: 0,
    lockedUntil: 0,
    successfulVerification: false,
  };

  userAttempts.attempts.push({
    timestamp: now,
    ip: clientIP,
    success: false,
  });
  userAttempts.lastAttempt = now;
  verifyAttempts.set(key, userAttempts);
};

const recordSuccessfulAttempt = (email) => {
  const key = email.toLowerCase().trim();
  const userAttempts = verifyAttempts.get(key) || {
    attempts: [],
    lastAttempt: 0,
    lockedUntil: 0,
    successfulVerification: false,
  };

  // Clear all failed attempts on successful verification
  userAttempts.attempts = [];
  userAttempts.lastAttempt = 0;
  userAttempts.lockedUntil = 0;
  userAttempts.successfulVerification = true;
  verifyAttempts.set(key, userAttempts);
};

const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Basic validation
    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // Validate OTP format (6 digits)
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: "OTP must be 6 digits",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const clientIP =
      req.ip || req.connection.remoteAddress || req.headers["x-forwarded-for"];

    // Check rate limiting
    const rateLimitCheck = checkVerifyRateLimit(normalizedEmail, clientIP);
    if (!rateLimitCheck.allowed) {
      // Record this as a failed attempt (rate limited)
      recordFailedAttempt(normalizedEmail, clientIP);

      const statusCode = rateLimitCheck.type === "lockout" ? 423 : 429; // 423 = Locked, 429 = Too Many Requests
      return res.status(statusCode).json({
        success: false,
        message: rateLimitCheck.error,
        retryAfter: rateLimitCheck.remainingTime,
        type: rateLimitCheck.type,
      });
    }

    // Find OTP in database
    const validOtp = await OTP.findOne({
      email: normalizedEmail,
      otp: otp.trim(),
    });

    if (!validOtp) {
      // Record failed attempt
      recordFailedAttempt(normalizedEmail, clientIP);

      // Check remaining attempts
      const remainingAttempts = rateLimitCheck.attemptsRemaining - 1;
      let message = "Invalid or expired OTP";

      if (remainingAttempts > 0) {
        message += `. ${remainingAttempts} attempts remaining.`;
      } else {
        message +=
          ". Account will be temporarily locked after one more failed attempt.";
      }

      return res.status(400).json({
        success: false,
        message,
        attemptsRemaining: remainingAttempts,
      });
    }

    // Find user
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Record failed attempt
      recordFailedAttempt(normalizedEmail, clientIP);

      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Record successful verification (clears rate limiting)
    recordSuccessfulAttempt(normalizedEmail);

    // Delete OTP after successful use
    await OTP.deleteOne({ _id: validOtp._id });

    // Generate JWT
    const payload = {
      id: user._id,
      userId: user.userId,
      role: user.designation,
      email: user.email,
      name: user.fullName || "Incomplete User",
      departmentName: user.departmentName || "Unknown Department",
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });

    // Set cookies (keeping your existing cookie strategy)
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
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    // Method 3: Base64 encoded
    const encodedToken = Buffer.from(token).toString("base64");
    res.cookie("encoded-token", encodedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 24 * 60 * 60 * 1000,
      path: "/",
    });

    // Log successful verification
    console.log(
      `OTP verified successfully for ${normalizedEmail} at ${new Date().toISOString()}`
    );

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

    // Don't record failed attempt for server errors
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

// Cleanup function to remove old rate limit data
const cleanupVerifyRateLimitData = () => {
  const now = Date.now();
  for (const [email, data] of verifyAttempts.entries()) {
    // Remove entries older than 2 hours or successful verifications older than 1 hour
    const shouldCleanup =
      now - data.lastAttempt > ATTEMPT_WINDOW * 8 || // 2 hours of inactivity
      (data.successfulVerification && now - data.lastAttempt > 3600000); // 1 hour after success

    if (shouldCleanup) {
      verifyAttempts.delete(email);
    }
  }
};

// Run cleanup every 30 minutes
setInterval(cleanupVerifyRateLimitData, 30 * 60 * 1000);

export default verifyOtp;
