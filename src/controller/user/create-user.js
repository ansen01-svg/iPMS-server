import bcrypt from "bcryptjs";
import User from "../../models/user.model.js";
import { sendMail } from "../../utils/mailSender.js";

// This function generates a random password with at least one uppercase letter,
// one lowercase letter, one number, and one special character.
function generateSecurePassword(length = 8) {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const specialChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";

  let password = "";

  // Ensure at least one character from each category
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += specialChars[Math.floor(Math.random() * specialChars.length)];

  // Fill the rest randomly
  const allChars = lowercase + uppercase + numbers + specialChars;
  for (let i = password.length; i < length; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  // Shuffle the password to avoid predictable patterns
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

// Generate unique userId
async function generateUserId(designation) {
  const designationPart = designation.toUpperCase().replace(/\s+/g, "");
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      // Get the highest existing number for this designation
      const lastUser = await User.findOne(
        {
          designation,
          userId: new RegExp(`^${designationPart}\\d+$`),
        },
        { userId: 1 }
      ).sort({ userId: -1 });

      let nextNumber = 1;
      if (lastUser && lastUser.userId) {
        const match = lastUser.userId.match(/(\d+)$/);
        if (match) {
          nextNumber = parseInt(match[1]) + 1;
        }
      }

      const userId = `${designationPart}${String(nextNumber).padStart(2, "0")}`;

      // Try to create with this ID - will fail if duplicate
      const existingUser = await User.findOne({ userId });
      if (!existingUser) {
        return userId;
      }

      attempts++;
    } catch (error) {
      attempts++;
      if (attempts >= maxAttempts) throw error;
    }
  }

  throw new Error(
    `Failed to generate unique userId after ${maxAttempts} attempts`
  );
}

// Validation helper
function validateUserInput(userData) {
  const errors = [];

  if (!userData.email?.trim()) {
    errors.push("Email is required");
  }

  if (!userData.phoneNumber?.trim()) {
    errors.push("Phone number is required");
  }

  if (!userData.designation?.trim()) {
    errors.push("Designation is required");
  }

  return errors;
}

const createUser = async (req, res) => {
  try {
    const {
      fullName,
      username,
      email,
      phoneNumber,
      departmentName,
      departmentId,
      designation,
      officeLocation,
      roleId,
    } = req.body;

    // Validate input
    const validationErrors = validateUserInput(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    // Generate unique userId and secure password
    const userId = await generateUserId(designation);
    const plainPassword = generateSecurePassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    const newUser = new User({
      fullName: fullName?.trim() || undefined,
      username: username?.trim() || undefined,
      email: email.toLowerCase().trim(),
      phoneNumber: phoneNumber.trim(),
      departmentName: departmentName?.trim() || undefined,
      departmentId: departmentId?.trim() || undefined,
      designation: designation.trim(),
      officeLocation: officeLocation?.trim() || undefined,
      roleId: roleId?.trim() || undefined,
      userId,
      password: hashedPassword,
      isFirstLogin: true,
    });

    const savedUser = await newUser.save();

    try {
      await sendMail(
        savedUser.email,
        "Your APTDCL Account Credentials",
        `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>APTDCL Account Credentials</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #279eab; margin: 0; font-size: 28px;">APTDCL</h1>
          </div>

          <div style="text-align: center; margin-bottom: 30px;">
            <h2 style="color: #333333; margin: 0 0 10px 0;">Welcome ${
              savedUser.fullName || ""
            }!</h2>
            <p style="color: #666666; margin: 0; font-size: 16px;">Your account has been created successfully</p>
          </div>

          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <p style="color: #333333; margin: 0 0 15px 0; font-size: 16px; text-align: center;">Your Account Credentials:</p>

            <div style="margin-bottom: 15px;">
              <p style="color: #666666; margin: 0 0 5px 0; font-size: 14px;">User ID:</p>
              <p style="color: #279eab; margin: 0; font-size: 18px; font-weight: bold;">${
                savedUser.userId
              }</p>
            </div>

            <div style="margin-bottom: 15px;">
              <p style="color: #666666; margin: 0 0 5px 0; font-size: 14px;">Temporary Password:</p>
              <p style="color: #279eab; margin: 0; font-size: 18px; font-weight: bold; letter-spacing: 2px;">${plainPassword}</p>
            </div>
          </div>

          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 15px; margin-bottom: 20px;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>Important:</strong> Please change your password after first login for security purposes. Do not share your credentials with anyone.
            </p>
          </div>

          <div style="text-align: center; color: #666666; font-size: 12px; border-top: 1px solid #eeeeee; padding-top: 20px;">
            <p style="margin: 0;">If you didn't request this account, please contact support immediately.</p>
            <p style="margin: 10px 0 0 0;">&copy; 2025 APTDCL. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `
      );
    } catch (mailError) {
      console.error(" Failed to send email:", mailError);
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      temporaryPassword: plainPassword, // Only shown once to admin
      user: {
        id: savedUser._id,
        userId: savedUser.userId,
        fullName: savedUser.fullName,
        username: savedUser.username,
        email: savedUser.email,
        phoneNumber: savedUser.phoneNumber,
        role: savedUser.designation,
        departmentName: savedUser.departmentName,
        officeLocation: savedUser.officeLocation,
        isFirstLogin: savedUser.isFirstLogin,
      },
    });
  } catch (error) {
    console.error("Create user error:", error);

    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    // Validate input
    if (!userId || !currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "User ID, current password, and new password are required",
      });
    }

    // Find user
    const user = await User.findOne({ userId });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Validate new password
    if (!User.validatePassword(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "New password must be at least 6 characters long and contain at least one special character",
      });
    }

    // Change password using the model method
    await user.changePassword(currentPassword, newPassword);

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Change password error:", error);

    if (error.message === "Current password is incorrect") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    if (error.message.includes("password must be")) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export { changePassword, createUser as default };
