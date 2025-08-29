// src/middlewares/validate-financial-progress.middleware.js
import { body, param, query, validationResult } from "express-validator";

// Validation rules for updating financial progress
export const validateFinancialProgressUpdate = [
  // Project ID validation
  param("id")
    .isMongoId()
    .withMessage("Invalid project ID format. Must be a valid MongoDB ObjectId"),

  // Bill amount validation
  body("newBillAmount")
    .notEmpty()
    .withMessage("New bill amount is required")
    .isFloat({ min: 0 })
    .withMessage("Bill amount must be a non-negative number")
    .custom((value) => {
      // Ensure amount has at most 2 decimal places
      const decimalPlaces = (value.toString().split(".")[1] || "").length;
      if (decimalPlaces > 2) {
        throw new Error("Bill amount can have at most 2 decimal places");
      }
      return true;
    }),

  // Remarks validation (optional)
  body("remarks")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Remarks cannot exceed 500 characters")
    .trim(),

  // Bill details validation
  body("billDetails")
    .optional()
    .isObject()
    .withMessage("Bill details must be an object"),

  body("billDetails.billNumber")
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage("Bill number must be between 1 and 50 characters")
    .trim(),

  body("billDetails.billDate")
    .optional()
    .isISO8601()
    .withMessage("Bill date must be a valid date")
    .custom((value) => {
      if (new Date(value) > new Date()) {
        throw new Error("Bill date cannot be in the future");
      }
      return true;
    }),

  body("billDetails.billDescription")
    .optional()
    .isLength({ max: 200 })
    .withMessage("Bill description cannot exceed 200 characters")
    .trim(),

  // Custom validation for completion requirements
  body("newBillAmount").custom((value, { req }) => {
    // This will be enhanced in the business rules validation
    // Basic check here for data type
    if (typeof value !== "number" && typeof value !== "string") {
      throw new Error("Bill amount must be a number");
    }
    return true;
  }),
];

// Validation rules for combined progress update
export const validateCombinedProgressUpdate = [
  // Project ID validation
  param("id")
    .isMongoId()
    .withMessage("Invalid project ID format. Must be a valid MongoDB ObjectId"),

  // Physical progress validation (optional)
  body("progress")
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage("Progress must be a number between 0 and 100")
    .custom((value) => {
      if (value !== undefined) {
        const decimalPlaces = (value.toString().split(".")[1] || "").length;
        if (decimalPlaces > 2) {
          throw new Error("Progress can have at most 2 decimal places");
        }
      }
      return true;
    }),

  // Financial progress validation (optional)
  body("newBillAmount")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Bill amount must be a non-negative number")
    .custom((value) => {
      if (value !== undefined) {
        const decimalPlaces = (value.toString().split(".")[1] || "").length;
        if (decimalPlaces > 2) {
          throw new Error("Bill amount can have at most 2 decimal places");
        }
      }
      return true;
    }),

  // At least one progress type must be provided
  body().custom((body) => {
    if (body.progress === undefined && body.newBillAmount === undefined) {
      throw new Error(
        "At least one progress update (progress or newBillAmount) must be provided"
      );
    }
    return true;
  }),

  // Common fields
  body("remarks")
    .optional()
    .isLength({ max: 500 })
    .withMessage("Remarks cannot exceed 500 characters")
    .trim(),

  body("billDetails")
    .optional()
    .isObject()
    .withMessage("Bill details must be an object"),
];

// Validation rules for financial progress history query
export const validateFinancialProgressHistoryQuery = [
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

// Validation rules for financial progress statistics query
export const validateFinancialProgressStatisticsQuery = [
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
export const handleFinancialValidationErrors = (req, res, next) => {
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
      message: "Financial progress validation failed",
      errors: formattedErrors,
      details: {
        errorCount: formattedErrors.length,
        timestamp: new Date().toISOString(),
        validationType: "financial_progress",
      },
    });
  }

  next();
};

// Business logic validation middleware for financial progress
export const validateFinancialProgressBusinessRules = async (
  req,
  res,
  next
) => {
  try {
    const { newBillAmount, billDetails } = req.body;

    // Add current time for audit trail
    req.financialProgressUpdateMetadata = {
      timestamp: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent") || "",
    };

    // Add warning flags for review
    req.financialProgressWarnings = [];

    // Check for weekend/holiday updates (optional business rule)
    const updateDate = new Date();
    const dayOfWeek = updateDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      req.financialProgressWarnings.push({
        type: "WEEKEND_FINANCIAL_UPDATE",
        message: "Financial progress updated during weekend",
        severity: "info",
      });
    }

    // Check for late night updates (optional business rule)
    const hour = updateDate.getHours();
    if (hour < 6 || hour > 22) {
      req.financialProgressWarnings.push({
        type: "OFF_HOURS_FINANCIAL_UPDATE",
        message: "Financial progress updated outside normal business hours",
        severity: "info",
      });
    }

    // Check for large financial updates (business rule)
    if (newBillAmount !== undefined) {
      const billAmount = parseFloat(newBillAmount);

      // Flag large amounts (>1 crore)
      if (billAmount > 10000000) {
        // 1 crore
        req.financialProgressWarnings.push({
          type: "LARGE_BILL_AMOUNT",
          message: "Large bill amount detected (>1 Crore). Please verify.",
          severity: "warning",
          amount: billAmount,
        });
      }
    }

    // Validate bill details for completion
    if (newBillAmount !== undefined && billDetails) {
      // Check if bill date is too far in the past (>90 days)
      if (billDetails.billDate) {
        const billDate = new Date(billDetails.billDate);
        const daysDiff = Math.ceil(
          (new Date() - billDate) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff > 90) {
          req.financialProgressWarnings.push({
            type: "OLD_BILL_DATE",
            message: "Bill date is more than 90 days old",
            severity: "warning",
            daysDifference: daysDiff,
          });
        }
      }
    }

    next();
  } catch (error) {
    console.error(
      "Error in financial progress business rules validation:",
      error
    );
    next(error);
  }
};

// File validation specific to financial progress updates
export const validateFinancialProgressFiles = (req, res, next) => {
  const files = req.firebaseFiles || [];
  const fileWarnings = [];
  const { newBillAmount } = req.body;

  if (files.length > 0) {
    // Check file types for financial updates
    const documentFiles = files.filter((f) => f.fileType === "document").length;
    const imageFiles = files.filter((f) => f.fileType === "image").length;

    // Recommend document files for financial completion
    if (newBillAmount !== undefined && documentFiles === 0) {
      const billAmount = parseFloat(newBillAmount);
      // Calculate potential financial progress (need work value for this)
      // This will be checked in the main controller with access to project data

      fileWarnings.push({
        type: "FINANCIAL_UPDATE_WITHOUT_DOCUMENTS",
        message:
          "Financial progress updated but no document files uploaded. Consider uploading bills or receipts.",
        severity: "info",
      });
    }

    // Check for bills or receipts in filename
    const hasBillFiles = files.some(
      (f) =>
        f.originalName.toLowerCase().includes("bill") ||
        f.originalName.toLowerCase().includes("receipt") ||
        f.originalName.toLowerCase().includes("invoice")
    );

    if (!hasBillFiles && documentFiles > 0) {
      fileWarnings.push({
        type: "NO_BILL_DOCUMENTS",
        message:
          "No bill/receipt/invoice files detected. Please ensure supporting documents are relevant.",
        severity: "info",
      });
    }

    // Check total file size
    const totalSize = files.reduce((sum, file) => sum + file.fileSize, 0);
    const totalSizeMB = totalSize / (1024 * 1024);

    if (totalSizeMB > 50) {
      // 50MB total warning
      fileWarnings.push({
        type: "LARGE_FINANCIAL_UPLOAD",
        message: `Large file upload detected (${totalSizeMB.toFixed(
          2
        )}MB). Consider compressing files.`,
        severity: "info",
      });
    }
  }

  req.financialFileWarnings = fileWarnings;
  next();
};

// Rate limiting for financial progress updates
export const financialProgressUpdateRateLimit = (req, res, next) => {
  const userKey = `financial_progress_update_${req.user?.id}_${req.params.id}`;
  const now = Date.now();

  // In production, implement proper rate limiting with Redis
  // For example: max 5 financial updates per hour per project per user
  // (More restrictive than regular progress updates due to financial nature)

  req.financialRateLimit = {
    userKey,
    timestamp: now,
    type: "financial_progress",
    // In real implementation, check against rate limit store
  };

  next();
};

// Comprehensive validation middleware that combines all validations
export const validateCompleteFinancialProgressUpdate = [
  validateFinancialProgressUpdate,
  handleFinancialValidationErrors,
  financialProgressUpdateRateLimit,
  validateFinancialProgressBusinessRules,
  validateFinancialProgressFiles,
];

// Comprehensive validation middleware for combined updates
export const validateCompleteCombinedProgressUpdate = [
  validateCombinedProgressUpdate,
  handleFinancialValidationErrors,
  financialProgressUpdateRateLimit,
  validateFinancialProgressBusinessRules,
  validateFinancialProgressFiles,
];

export default {
  validateFinancialProgressUpdate,
  validateCombinedProgressUpdate,
  validateFinancialProgressHistoryQuery,
  validateFinancialProgressStatisticsQuery,
  handleFinancialValidationErrors,
  validateFinancialProgressBusinessRules,
  validateFinancialProgressFiles,
  financialProgressUpdateRateLimit,
  validateCompleteFinancialProgressUpdate,
  validateCompleteCombinedProgressUpdate,
};
