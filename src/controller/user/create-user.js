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
async function generateUserId(designation, roleId) {
  const designationPart = designation.toUpperCase().replace(/\s+/g, "");
  const rolePart = roleId.toUpperCase();

  const count = await User.countDocuments({ designation, roleId });
  return `${designationPart}${rolePart}${String(count + 1).padStart(2, "0")}`;
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
    const userId = await generateUserId(designation, roleId);
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
          <h2>Welcome ${savedUser.fullName || ""}</h2>
          <p>Your account has been created successfully.</p>
          <p><strong>User ID:</strong> ${savedUser.userId}</p>
          <p><strong>Temporary Password:</strong> ${plainPassword}</p>
          <p>Please change your password after first login.</p>
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
