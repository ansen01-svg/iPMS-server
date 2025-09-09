import crypto from "crypto";
import dotenv from "dotenv";
import OTP from "../../models/otp.model.js";
import User from "../../models/user.model.js";
import { resendOTP } from "../../utils/mailSender.js";

dotenv.config();

// In-memory store for rate limiting (use Redis in production)
const resendAttempts = new Map();
const RESEND_COOLDOWN = 60000; // 60 seconds between resends
const MAX_RESEND_ATTEMPTS = 5; // Max 5 resends per hour
const HOURLY_LIMIT_WINDOW = 3600000; // 1 hour
const OTP_EXPIRY_MINUTES = 5; // OTP expires in 5 minutes

// Rate limiting helper functions
const checkRateLimit = (email) => {
  const now = Date.now();
  const userAttempts = resendAttempts.get(email) || {
    attempts: [],
    lastResend: 0,
  };

  // Check cooldown period (60 seconds)
  if (now - userAttempts.lastResend < RESEND_COOLDOWN) {
    const remainingTime = Math.ceil(
      (RESEND_COOLDOWN - (now - userAttempts.lastResend)) / 1000
    );
    return {
      allowed: false,
      error: `Please wait ${remainingTime} seconds before requesting another OTP`,
      remainingTime,
      type: "cooldown",
    };
  }

  // Clean old attempts (older than 1 hour)
  userAttempts.attempts = userAttempts.attempts.filter(
    (timestamp) => now - timestamp < HOURLY_LIMIT_WINDOW
  );

  // Check hourly limit
  if (userAttempts.attempts.length >= MAX_RESEND_ATTEMPTS) {
    const oldestAttempt = Math.min(...userAttempts.attempts);
    const resetTime = Math.ceil(
      (HOURLY_LIMIT_WINDOW - (now - oldestAttempt)) / 60000
    );
    return {
      allowed: false,
      error: `Maximum resend attempts reached. Try again in ${resetTime} minutes.`,
      remainingTime: resetTime,
      type: "hourly_limit",
    };
  }

  return { allowed: true };
};

const updateRateLimit = (email) => {
  const now = Date.now();
  const userAttempts = resendAttempts.get(email) || {
    attempts: [],
    lastResend: 0,
  };

  userAttempts.attempts.push(now);
  userAttempts.lastResend = now;
  resendAttempts.set(email, userAttempts);
};

const resendOTPController = async (req, res) => {
  try {
    const { email } = req.body;

    // Validate email input
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user exists
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address",
      });
    }

    // Check rate limiting
    const rateLimitCheck = checkRateLimit(normalizedEmail);
    if (!rateLimitCheck.allowed) {
      const statusCode = rateLimitCheck.type === "cooldown" ? 429 : 429;
      return res.status(statusCode).json({
        success: false,
        message: rateLimitCheck.error,
        retryAfter: rateLimitCheck.remainingTime,
        type: rateLimitCheck.type,
      });
    }

    // Check if there's an existing OTP that's still valid
    const existingOTP = await OTP.findOne({ email: normalizedEmail });
    if (existingOTP) {
      const now = new Date();
      const otpCreatedAt = existingOTP.createdAt;
      const timeDiff = (now - otpCreatedAt) / 1000; // in seconds

      // If OTP is less than 30 seconds old, prevent spam
      if (timeDiff < 30) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${Math.ceil(
            30 - timeDiff
          )} seconds before requesting a new OTP`,
          retryAfter: Math.ceil(30 - timeDiff),
        });
      }
    }

    // Generate new OTP (6-digit random number)
    const newOTP = crypto.randomInt(100000, 999999).toString();

    // Calculate expiry time (5 minutes from now)
    const expiryTime = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Update or create OTP record in database
    await OTP.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        otp: newOTP,
        createdAt: new Date(),
        expiresAt: expiryTime,
      },
      {
        upsert: true, // Create if doesn't exist
        new: true,
      }
    );

    // Send OTP email using your email utility
    try {
      const emailResult = await resendOTP(normalizedEmail, newOTP);

      // Update rate limiting after successful email send
      updateRateLimit(normalizedEmail);

      // Log successful resend (optional)
      console.log(
        `OTP resent successfully to ${normalizedEmail} at ${new Date().toISOString()}`
      );

      // Success response
      return res.status(200).json({
        success: true,
        message: "OTP has been resent successfully to your email",
        data: {
          email: normalizedEmail,
          expiresIn: `${OTP_EXPIRY_MINUTES} minutes`,
          messageId: emailResult.messageId,
        },
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);

      // Remove the OTP from database if email failed
      await OTP.deleteOne({ email: normalizedEmail });

      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again later.",
      });
    }
  } catch (error) {
    console.error("Resend OTP error:", error);

    // Generic error response
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};

// Optional: Cleanup function to clear old rate limit data
const cleanupRateLimitData = () => {
  const now = Date.now();
  for (const [email, data] of resendAttempts.entries()) {
    // Remove entries older than 2 hours
    if (now - data.lastResend > HOURLY_LIMIT_WINDOW * 2) {
      resendAttempts.delete(email);
    }
  }
};

// Run cleanup every hour (optional)
setInterval(cleanupRateLimitData, HOURLY_LIMIT_WINDOW);

export default resendOTPController;
