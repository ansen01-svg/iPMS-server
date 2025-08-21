import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { userRoles } from "../utils/constants.js";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
    },
    username: {
      type: String,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      trim: true,
      match: [
        /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/,
        "Please enter a valid email",
      ],
    },
    phoneNumber: {
      type: String,
      required: [true, "Phone number is required"],
      trim: true,
      match: [/^[\+]?[1-9][\d]{0,15}$/, "Please enter a valid phone number"],
    },
    roleId: {
      type: String,
    },
    departmentName: {
      type: String,
    },
    departmentId: {
      type: String,
      trim: true,
    },
    designation: {
      type: String,
      enum: {
        values: userRoles,
        message: "Invalid designation. Must be one of: {VALUE}",
      },
      required: [true, "Designation is required"],
    },
    officeLocation: {
      type: String,
      trim: true,
      maxlength: [100, "Office location cannot exceed 100 characters"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
    },
    userId: {
      type: String,
      required: [true, "User ID is required"],
      unique: true,
      trim: true,
    },
    isFirstLogin: {
      type: Boolean,
      default: true,
    },
    lastPasswordChange: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        return ret;
      },
    },
  }
);

// Index for better query performance
userSchema.index({ designation: 1, roleId: 1 });

// Instance method to change password
userSchema.methods.changePassword = async function (
  currentPassword,
  newPassword
) {
  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    this.password
  );
  if (!isCurrentPasswordValid) {
    throw new Error("Current password is incorrect");
  }

  // Validate new password
  if (!validatePassword(newPassword)) {
    throw new Error(
      "New password must be at least 6 characters long and contain at least one special character"
    );
  }

  // Hash and save new password
  this.password = await bcrypt.hash(newPassword, 12);
  this.lastPasswordChange = new Date();
  this.isFirstLogin = false;

  return await this.save();
};

// Static method to validate password strength
userSchema.statics.validatePassword = function (password) {
  return validatePassword(password);
};

// Helper function for password validation
function validatePassword(password) {
  const minLength = 6;
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  return password && password.length >= minLength && hasSpecialChar;
}

const User = mongoose.model("User", userSchema);

export default User;
