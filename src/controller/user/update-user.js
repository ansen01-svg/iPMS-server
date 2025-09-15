import User from "../../models/user.model.js";

// Get user profile
export const getUserProfile = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    console.log(userId);

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const user = await User.findOne({ userId }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User profile retrieved successfully",
      data: user,
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update user profile
export const updateUserProfile = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "User not authenticated",
      });
    }

    const { avatar, username, phoneNumber, email } = req.body;

    // Check if at least one field is provided for update
    if (!avatar && !username && !phoneNumber && !email) {
      return res.status(400).json({
        success: false,
        message:
          "At least one field (avatar, username, phoneNumber, email) must be provided for update",
      });
    }

    // Find the current user
    const currentUser = await User.findOne({ userId });
    console.log("currentUser", currentUser);

    if (!currentUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Prepare update object with only the fields that are provided
    const updateData = {};

    if (avatar !== undefined) updateData.avatar = avatar;
    if (username !== undefined) {
      if (username.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: "Username cannot be empty",
        });
      }
      updateData.username = username.trim();
    }

    if (phoneNumber !== undefined) {
      if (!phoneNumber.trim()) {
        return res.status(400).json({
          success: false,
          message: "Phone number cannot be empty",
        });
      }

      // Validate phone number format
      const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
      if (!phoneRegex.test(phoneNumber.trim())) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid phone number",
        });
      }
      updateData.phoneNumber = phoneNumber.trim();
    }

    if (email !== undefined) {
      if (!email.trim()) {
        return res.status(400).json({
          success: false,
          message: "Email cannot be empty",
        });
      }

      // Validate email format
      const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
      if (!emailRegex.test(email.trim())) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid email",
        });
      }

      // Check if email is already taken by another user
      const existingEmailUser = await User.findOne({
        email: email.trim().toLowerCase(),
        _id: { $ne: userId },
      });

      if (existingEmailUser) {
        return res.status(409).json({
          success: false,
          message: "Email is already registered with another account",
        });
      }

      updateData.email = email.trim().toLowerCase();
    }

    // Update user with validation

    const updatedUser = await User.findOneAndUpdate(
      { userId }, // Filter object - this is the key correction
      updateData,
      {
        new: true,
        runValidators: true,
        select: "-password",
      }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update user profile error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: validationErrors,
      });
    }

    // Handle duplicate key error (for unique fields)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(409).json({
        success: false,
        message: `${field} is already taken`,
      });
    }

    // Handle cast error (invalid ObjectId)
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Additional helper function to get user by custom userId field
export const getUserByUserId = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(userId);

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await User.findOne({ userId }).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "User found successfully",
      data: user,
    });
  } catch (error) {
    console.error("Get user by userId error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
