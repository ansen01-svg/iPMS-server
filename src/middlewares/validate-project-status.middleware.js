// src/middlewares/validate-project-status.middleware.js

import rateLimit from "express-rate-limit";
import { body, query, validationResult } from "express-validator";

// Valid project statuses
const VALID_STATUSES = [
  "Submitted for Approval",
  "Resubmitted for Approval",
  "Rejected by AEE",
  "Rejected by CE",
  "Rejected by MD",
  "Ongoing",
  "Completed",
];

// Rate limiting for status updates
export const statusUpdateRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each user to 20 status updates per windowMs
  message: {
    success: false,
    message: "Too many status update requests. Please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Create key based on user ID only (more reliable than IP-based limiting)
    const userId = req.user?.userId || req.user?.id || "anonymous";
    return `status_update_${userId}`;
  },
  skip: (req) => {
    // Skip rate limiting for certain roles in development
    if (process.env.NODE_ENV === "development") {
      return false; // Apply rate limiting even in development
    }
    return false;
  },
});

// Validation for status update
export const validateStatusUpdate = [
  body("newStatus")
    .notEmpty()
    .withMessage("New status is required")
    .isIn(VALID_STATUSES)
    .withMessage(
      `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
    ),

  body("remarks")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Remarks cannot exceed 500 characters"),

  body("rejectionReason")
    .if(body("newStatus").matches(/^Rejected by/))
    .notEmpty()
    .withMessage("Rejection reason is required for rejected status")
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage("Rejection reason must be between 10 and 1000 characters"),

  body("rejectionReason")
    .if(
      body("newStatus")
        .not()
        .matches(/^Rejected by/)
    )
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Rejection reason cannot exceed 1000 characters"),

  // Custom validation to check rejection reason when needed
  body().custom((value, { req }) => {
    const { newStatus, rejectionReason } = req.body;

    if (
      newStatus &&
      newStatus.includes("Rejected") &&
      !rejectionReason?.trim()
    ) {
      throw new Error("Rejection reason is required for rejected status");
    }

    return true;
  }),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

// Validation for status history query
export const validateStatusHistoryQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50")
    .toInt(),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

// Validation for status list query (get projects by status)
export const validateStatusListQuery = [
  query("status")
    .optional()
    .isIn(VALID_STATUSES)
    .withMessage(
      `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
    ),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer")
    .toInt(),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50")
    .toInt(),

  query("district")
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage("District must be between 2 and 50 characters"),

  query("fund")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage("Fund must be between 2 and 100 characters"),

  query("createdBy")
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage("CreatedBy must be between 1 and 100 characters"),

  query("sortBy")
    .optional()
    .isIn(["updatedAt", "createdAt", "projectName", "estimatedCost", "status"])
    .withMessage("Invalid sortBy field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Sort order must be 'asc' or 'desc'"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        errors: errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

// Role-based authorization middleware for status updates
export const authorizeStatusUpdate = (req, res, next) => {
  try {
    const user = req.user;
    const { newStatus } = req.body;

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const userRole = user.designation || user.role;
    const allowedRoles = ["JE", "AEE", "CE", "MD"];

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized role for status updates",
        userRole,
        allowedRoles,
      });
    }

    // Role-specific validations
    if (userRole === "JE") {
      const allowedJEStatuses = ["Resubmitted for Approval", "Completed"];
      if (!allowedJEStatuses.includes(newStatus)) {
        return res.status(403).json({
          success: false,
          message: `JE can only set status to: ${allowedJEStatuses.join(", ")}`,
        });
      }
    } else if (["AEE", "CE", "MD"].includes(userRole)) {
      const allowedApproverStatuses = ["Ongoing", `Rejected by ${userRole}`];
      if (!allowedApproverStatuses.includes(newStatus)) {
        return res.status(403).json({
          success: false,
          message: `${userRole} can only set status to: ${allowedApproverStatuses.join(
            ", "
          )}`,
        });
      }
    }

    next();
  } catch (error) {
    console.error("Error in status update authorization:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during authorization",
    });
  }
};

// Middleware to validate bulk status updates
export const validateBulkStatusUpdate = [
  body("updates")
    .isArray({ min: 1, max: 20 })
    .withMessage("Updates must be an array with 1-20 items"),

  body("updates.*.projectId")
    .notEmpty()
    .withMessage("Project ID is required for each update")
    .isMongoId()
    .withMessage("Invalid project ID format"),

  body("updates.*.newStatus")
    .notEmpty()
    .withMessage("New status is required for each update")
    .isIn(VALID_STATUSES)
    .withMessage(
      `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`
    ),

  body("updates.*.remarks")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Remarks cannot exceed 500 characters"),

  body("updates.*.rejectionReason")
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage("Rejection reason cannot exceed 1000 characters"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Bulk update validation failed",
        errors: errors.array().map((error) => ({
          field: error.path,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

// Middleware to log status update attempts
export const logStatusUpdate = (req, res, next) => {
  const { id } = req.params;
  const { newStatus } = req.body;
  const user = req.user;

  console.log(
    `Status update attempt: Project ${id} -> ${newStatus} by ${
      user?.name || "Unknown"
    } (${user?.designation || user?.role || "Unknown role"}) from IP ${req.ip}`
  );

  next();
};

// Middleware to handle validation errors consistently
export const handleStatusValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => {
      return {
        field: error.path,
        message: error.msg,
        value: error.value,
        location: error.location,
      };
    });

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: formattedErrors,
      timestamp: new Date().toISOString(),
    });
  }
  next();
};

// Export valid statuses for use in other modules
export { VALID_STATUSES };
