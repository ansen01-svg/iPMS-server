import express from "express";
import createUser from "../controller/user/create-user.js";
import getAllUsers from "../controller/user/get-all-users.js";
import {
  getUserByUserId,
  getUserProfile,
  updateUserProfile,
} from "../controller/user/update-user.js";
import { requireAdmin, requireLogin } from "../middlewares/auth.middleware.js";
import {
  cleanupAvatarFile,
  uploadAvatarToS3,
} from "../middlewares/s3-bucket-file-upload/avatar-upload.middleware.js";

const router = express.Router();

router.get("/", requireAdmin(), getAllUsers);
router.post("/", requireAdmin(), createUser);

// Get current user's profile (requires authentication)
router.get("/profile", requireLogin(), getUserProfile);

// Update current user's profile with optional avatar upload (requires authentication)
router.put(
  "/profile",
  requireLogin(),
  uploadAvatarToS3,
  cleanupAvatarFile,
  updateUserProfile
);

// Get user by custom userId (for admin or specific use cases)
router.get("/user/:userId", requireAdmin(), getUserByUserId);

export default router;
