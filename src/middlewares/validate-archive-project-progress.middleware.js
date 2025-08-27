import { body, param, query, validationResult } from "express-validator";

// Validation rules for updating progress
export const validateProgressUpdate = [
  // Project ID validation
  param("id")
    .isMongoId()
    .withMessage("Invalid project ID format. Must be a valid MongoDB ObjectId"),

  // Progress validation
  body("progress")
    .notEmpty()
    .withMessage("Progress is required")
    .isFloat({ min: 0, max: 100 })
    .withMessage("Progress must be a number between 0 and 100")
    .custom((value) => {
      // Ensure progress has at most 2 decimal places
      const decimalPlaces = (value.toString().split(".")[1] || "").length;
      if (decimalPlaces > 2) {
        throw new Error("Progress can have at most 2 decimal places");
      }
      return true;
    }),

  // Remarks validation (optional)
  body("remarks")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Remarks cannot exceed 500 characters")
    .trim(),

  // Custom validation for file requirements based on progress
  body("progress").custom((value, { req }) => {
    const progress = parseFloat(value);

    // If marking as completed, must have files
    if (progress === 100 && (!req.files || req.files.length === 0)) {
      throw new Error(
        "At least one supporting file is required when marking project as completed (100%)"
      );
    }

    // If significant progress increase (>25%), recommend files
    if (
      req.body.currentProgress &&
      progress - parseFloat(req.body.currentProgress) > 25
    ) {
      if (!req.files || req.files.length === 0) {
        console.warn(
          `Large progress update (${progress}%) without supporting files for project ${req.params.id}`
        );
      }
    }

    return true;
  }),
];

// Validation rules for progress history query
export const validateProgressHistoryQuery = [
  param("id").isMongoId().withMessage("Invalid project ID format"),

  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),
];

// Validation rules for progress statistics query
export const validateProgressStatisticsQuery = [
  query("financialYear")
    .optional()
    .matches(/^\d{4}-\d{4}$/)
    .withMessage("Financial year must be in YYYY-YYYY format"),

  query("concernedEngineer")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Concerned engineer name must be between 2 and 100 characters")
    .trim(),

  query("startDate")
    .optional()
    .isISO8601()
    .withMessage("Start date must be a valid ISO 8601 date"),

  query("endDate")
    .optional()
    .isISO8601()
    .withMessage("End date must be a valid ISO 8601 date")
    .custom((value, { req }) => {
      if (req.query.startDate && value) {
        const startDate = new Date(req.query.startDate);
        const endDate = new Date(value);
        if (endDate <= startDate) {
          throw new Error("End date must be after start date");
        }
      }
      return true;
    }),
];

// Middleware to handle validation errors
export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((error) => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value,
      location: error.location,
    }));

    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: formattedErrors,
      details: {
        errorCount: formattedErrors.length,
        timestamp: new Date().toISOString(),
      },
    });
  }

  next();
};

// Business logic validation middleware
export const validateProgressBusinessRules = async (req, res, next) => {
  try {
    const { progress } = req.body;
    const progressValue = parseFloat(progress);

    // Add current time for audit trail
    req.progressUpdateMetadata = {
      timestamp: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent") || "",
    };

    // Add warning flags for review
    req.progressWarnings = [];

    // Check for weekend/holiday updates (optional business rule)
    const updateDate = new Date();
    const dayOfWeek = updateDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Sunday or Saturday
      req.progressWarnings.push({
        type: "WEEKEND_UPDATE",
        message: "Progress updated during weekend",
        severity: "info",
      });
    }

    // Check for late night updates (optional business rule)
    const hour = updateDate.getHours();
    if (hour < 6 || hour > 22) {
      req.progressWarnings.push({
        type: "OFF_HOURS_UPDATE",
        message: "Progress updated outside normal business hours",
        severity: "info",
      });
    }

    // Check for rapid successive updates (prevent spam)
    if (req.rateLimit) {
      req.progressWarnings.push({
        type: "RAPID_UPDATES",
        message: "Multiple progress updates in short timeframe",
        severity: "warning",
      });
    }

    next();
  } catch (error) {
    console.error("Error in business rules validation:", error);
    next(error);
  }
};

// File validation specific to progress updates
export const validateProgressFiles = (req, res, next) => {
  const files = req.files || [];
  const fileWarnings = [];

  // Check file distribution
  const imageFiles = files.filter((f) =>
    f.mimetype.startsWith("image/")
  ).length;
  const documentFiles = files.length - imageFiles;

  if (files.length > 0) {
    // Recommend document files for completion
    if (parseFloat(req.body.progress) === 100 && documentFiles === 0) {
      fileWarnings.push({
        type: "COMPLETION_WITHOUT_DOCUMENTS",
        message:
          "Project marked as completed but no document files uploaded. Consider uploading completion certificates or reports.",
        severity: "warning",
      });
    }

    // Check total file size
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    const totalSizeMB = totalSize / (1024 * 1024);

    if (totalSizeMB > 50) {
      // 50MB total warning
      fileWarnings.push({
        type: "LARGE_UPLOAD",
        message: `Large file upload detected (${totalSizeMB.toFixed(
          2
        )}MB). Consider compressing files.`,
        severity: "info",
      });
    }
  }

  req.fileWarnings = fileWarnings;
  next();
};

// Rate limiting for progress updates (prevent abuse)
export const progressUpdateRateLimit = (req, res, next) => {
  // This would typically use Redis or in-memory store
  // For now, just add to request for tracking
  const userKey = `progress_update_${req.user?.id}_${req.params.id}`;
  const now = Date.now();

  // In production, implement proper rate limiting
  // For example: max 10 updates per hour per project per user

  req.rateLimit = {
    userKey,
    timestamp: now,
    // In real implementation, check against rate limit store
  };

  next();
};
