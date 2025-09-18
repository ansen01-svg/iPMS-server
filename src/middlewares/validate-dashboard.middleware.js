import { query, validationResult } from "express-validator";

/**
 * Validation middleware for dashboard KPIs endpoint
 */
export const validateDashboardQuery = [
  query("includeArchive")
    .optional()
    .isBoolean()
    .withMessage("includeArchive must be a boolean"),

  query("timeRange")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("timeRange must be between 1 and 365 days"),

  query("district")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("District name must be between 2 and 50 characters"),

  query("fund")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Fund name must be between 2 and 100 characters"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((error) => ({
          field: error.param,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

/**
 * Validation middleware for recent activity endpoint
 */
export const validateActivityQuery = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),

  query("days")
    .optional()
    .isInt({ min: 1, max: 30 })
    .withMessage("Days must be between 1 and 30"),

  query("type")
    .optional()
    .isIn([
      "status_change",
      "progress_update",
      "financial_update",
      "project_created",
      "all",
    ])
    .withMessage("Invalid activity type"),

  query("priority")
    .optional()
    .isIn(["high", "medium", "low", "all"])
    .withMessage("Invalid priority level"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((error) => ({
          field: error.param,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

/**
 * Validation middleware for action items endpoint
 */
export const validateActionItemsQuery = [
  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),

  query("priority")
    .optional()
    .isIn(["high", "medium", "low", "all"])
    .withMessage("Invalid priority level"),

  query("type")
    .optional()
    .isIn([
      "pending_approval",
      "overdue_project",
      "open_query",
      "overdue_query",
      "all",
    ])
    .withMessage("Invalid action item type"),

  query("urgencyOnly")
    .optional()
    .isBoolean()
    .withMessage("urgencyOnly must be a boolean"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((error) => ({
          field: error.param,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

/**
 * Validation middleware for query KPIs endpoint
 */
export const validateQueryKPIsQuery = [
  query("includeArchive")
    .optional()
    .isBoolean()
    .withMessage("includeArchive must be a boolean"),

  query("timeRange")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("timeRange must be between 1 and 365 days"),

  query("category")
    .optional()
    .isIn([
      "Technical",
      "Financial",
      "Administrative",
      "Legal",
      "Compliance",
      "Design",
      "Material",
      "Safety",
      "Environmental",
      "Other",
    ])
    .withMessage("Invalid query category"),

  query("priority")
    .optional()
    .isIn(["Low", "Medium", "High", "Urgent"])
    .withMessage("Invalid priority level"),

  query("status")
    .optional()
    .isIn([
      "Open",
      "In Progress",
      "Under Review",
      "Resolved",
      "Closed",
      "Escalated",
    ])
    .withMessage("Invalid query status"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((error) => ({
          field: error.param,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

/**
 * Validation middleware for query trends endpoint
 */
export const validateQueryTrendsQuery = [
  query("period")
    .optional()
    .isIn(["daily", "weekly", "monthly"])
    .withMessage("Period must be daily, weekly, or monthly"),

  query("periods")
    .optional()
    .isInt({ min: 1, max: 52 })
    .withMessage("Periods must be between 1 and 52"),

  query("category")
    .optional()
    .isIn([
      "Technical",
      "Financial",
      "Administrative",
      "Legal",
      "Compliance",
      "Design",
      "Material",
      "Safety",
      "Environmental",
      "Other",
    ])
    .withMessage("Invalid query category"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((error) => ({
          field: error.param,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

/**
 * Validation middleware for financial health endpoint
 */
export const validateFinancialHealthQuery = [
  query("includeArchive")
    .optional()
    .isBoolean()
    .withMessage("includeArchive must be a boolean"),

  query("district")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("District name must be between 2 and 50 characters"),

  query("fund")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Fund name must be between 2 and 100 characters"),

  query("minValue")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Minimum value must be a positive number"),

  query("maxValue")
    .optional()
    .isFloat({ min: 0 })
    .withMessage("Maximum value must be a positive number"),

  // Custom validation to ensure maxValue > minValue
  query("maxValue")
    .optional()
    .custom((value, { req }) => {
      if (
        req.query.minValue &&
        parseFloat(value) <= parseFloat(req.query.minValue)
      ) {
        throw new Error("Maximum value must be greater than minimum value");
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
          field: error.param,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

/**
 * Validation middleware for performance indicators endpoint
 */
export const validatePerformanceQuery = [
  query("timeRange")
    .optional()
    .isInt({ min: 1, max: 365 })
    .withMessage("timeRange must be between 1 and 365 days"),

  query("includeCompleted")
    .optional()
    .isBoolean()
    .withMessage("includeCompleted must be a boolean"),

  query("district")
    .optional()
    .isLength({ min: 2, max: 50 })
    .withMessage("District name must be between 2 and 50 characters"),

  query("fund")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Fund name must be between 2 and 100 characters"),

  query("contractor")
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage("Contractor name must be between 2 and 100 characters"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((error) => ({
          field: error.param,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

/**
 * Validation middleware for workload distribution endpoint
 */
export const validateWorkloadQuery = [
  query("groupBy")
    .optional()
    .isIn(["user", "district", "status", "fund", "contractor"])
    .withMessage(
      "GroupBy must be one of: user, district, status, fund, contractor"
    ),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 50 })
    .withMessage("Limit must be between 1 and 50"),

  query("includeInactive")
    .optional()
    .isBoolean()
    .withMessage("includeInactive must be a boolean"),

  query("sortBy")
    .optional()
    .isIn(["count", "value", "progress", "completion"])
    .withMessage("SortBy must be one of: count, value, progress, completion"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("SortOrder must be asc or desc"),

  // Handle validation errors
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array().map((error) => ({
          field: error.param,
          message: error.msg,
          value: error.value,
        })),
      });
    }
    next();
  },
];

/**
 * Rate limiting middleware for dashboard endpoints
 */
export const dashboardRateLimit = (req, res, next) => {
  const userRequests = req.user.dashboardRequests || [];
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;

  // Filter out requests older than 5 minutes
  const recentRequests = userRequests.filter(
    (timestamp) => timestamp > fiveMinutesAgo
  );

  // Check if user has exceeded rate limit (30 requests per 5 minutes)
  if (recentRequests.length >= 30) {
    return res.status(429).json({
      success: false,
      message: "Rate limit exceeded. Please wait before making more requests.",
      retryAfter: 300, // 5 minutes in seconds
    });
  }

  // Add current request timestamp
  recentRequests.push(now);
  req.user.dashboardRequests = recentRequests;

  next();
};

/**
 * Generic error handler for dashboard routes
 */
export const dashboardErrorHandler = (error, req, res, next) => {
  console.error("Dashboard Error:", error);

  // MongoDB/Mongoose errors
  if (error.name === "MongoError" || error.name === "MongooseError") {
    return res.status(500).json({
      success: false,
      message: "Database error occurred",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }

  // Validation errors
  if (error.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      message: "Data validation failed",
      errors: Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
      })),
    });
  }

  // Cast errors (invalid ObjectId, etc.)
  if (error.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: "Invalid data format",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }

  // Authorization errors
  if (error.name === "UnauthorizedError") {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
};

/**
 * Middleware to validate user permissions for specific dashboard features
 */
export const validateDashboardPermissions = (requiredPermission) => {
  return (req, res, next) => {
    const { designation } = req.user;

    const permissions = {
      viewAllProjects: ["MD", "CE", "ADMIN"],
      viewFinancials: ["MD", "CE", "AEE", "ADMIN"],
      viewAnalytics: ["MD", "CE", "AEE", "ADMIN"],
      viewContractorData: ["MD", "CE", "AEE", "ADMIN"],
      viewDistrictData: ["MD", "CE", "AEE", "ADMIN"],
      approveProjects: ["MD", "CE", "AEE", "ADMIN"],
      exportData: ["MD", "CE", "AEE", "ADMIN"],
      manageQueries: ["MD", "CE", "AEE", "JE", "ADMIN"],
      viewOwnProjects: ["JE"],
    };

    if (!permissions[requiredPermission]) {
      return res.status(400).json({
        success: false,
        message: "Invalid permission specified",
      });
    }

    if (!permissions[requiredPermission].includes(designation)) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions to access this resource",
        requiredRole: permissions[requiredPermission],
        userRole,
      });
    }

    next();
  };
};

/**
 * Middleware to log dashboard access for analytics
 */
export const logDashboardAccess = (req, res, next) => {
  const logData = {
    userId: req.user.userId,
    userRole: req.user.userRole,
    endpoint: req.path,
    method: req.method,
    query: req.query,
    timestamp: new Date(),
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  };

  // In production, you might want to store this in a separate analytics collection
  // console.log("Dashboard Access:", JSON.stringify(logData, null, 2));

  next();
};

export default {
  validateDashboardQuery,
  validateActivityQuery,
  validateActionItemsQuery,
  validateQueryKPIsQuery,
  validateQueryTrendsQuery,
  validateFinancialHealthQuery,
  validatePerformanceQuery,
  validateWorkloadQuery,
  dashboardRateLimit,
  dashboardErrorHandler,
  validateDashboardPermissions,
  logDashboardAccess,
};
