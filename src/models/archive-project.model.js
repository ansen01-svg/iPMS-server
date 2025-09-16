import mongoose from "mongoose";

// Schema for individual progress updates (physical/work progress)
const progressUpdateSchema = new mongoose.Schema(
  {
    previousProgress: {
      type: Number,
      min: [0, "Progress cannot be negative"],
      max: [100, "Progress cannot exceed 100%"],
      required: true,
    },
    newProgress: {
      type: Number,
      min: [0, "Progress cannot be negative"],
      max: [100, "Progress cannot exceed 100%"],
      required: true,
    },
    progressDifference: {
      type: Number,
      required: true,
    },
    remarks: {
      type: String,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
      trim: true,
    },
    supportingDocuments: [
      {
        fileName: {
          type: String,
          required: true,
        },
        originalName: {
          type: String,
          required: true,
        },
        downloadURL: {
          type: String,
          required: true,
        },
        filePath: {
          type: String,
          required: true, // Firebase storage path for deletion
        },
        fileSize: {
          type: Number,
          required: true,
        },
        mimeType: {
          type: String,
          required: true,
        },
        fileType: {
          type: String,
          enum: ["document", "image"],
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    updatedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      userName: {
        type: String,
        required: true,
      },
      userDesignation: {
        type: String,
        required: true,
      },
    },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);

// Schema for individual financial progress updates
const financialProgressUpdateSchema = new mongoose.Schema(
  {
    previousFinancialProgress: {
      type: Number,
      min: [0, "Financial progress cannot be negative"],
      max: [100, "Financial progress cannot exceed 100%"],
      required: true,
    },
    newFinancialProgress: {
      type: Number,
      min: [0, "Financial progress cannot be negative"],
      max: [100, "Financial progress cannot exceed 100%"],
      required: true,
    },
    progressDifference: {
      type: Number,
      required: true,
    },
    previousBillAmount: {
      type: Number,
      min: [0, "Bill amount cannot be negative"],
      required: true,
    },
    newBillAmount: {
      type: Number,
      min: [0, "Bill amount cannot be negative"],
      required: true,
    },
    amountDifference: {
      type: Number,
      required: true,
    },
    remarks: {
      type: String,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
      trim: true,
    },
    billDetails: {
      billNumber: {
        type: String,
        trim: true,
      },
      billDate: {
        type: Date,
      },
      billDescription: {
        type: String,
        maxlength: [200, "Bill description cannot exceed 200 characters"],
        trim: true,
      },
    },
    supportingDocuments: [
      {
        fileName: {
          type: String,
          required: true,
        },
        originalName: {
          type: String,
          required: true,
        },
        downloadURL: {
          type: String,
          required: true,
        },
        filePath: {
          type: String,
          required: true, // Firebase storage path for deletion
        },
        fileSize: {
          type: Number,
          required: true,
        },
        mimeType: {
          type: String,
          required: true,
        },
        fileType: {
          type: String,
          enum: ["document", "image"],
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    updatedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      userName: {
        type: String,
        required: true,
      },
      userDesignation: {
        type: String,
        required: true,
      },
    },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);
const raisedQuerySchema = new mongoose.Schema(
  {
    queryId: {
      type: String,
      required: [true, "Query ID is required"],
      unique: true,
      index: true,
    },
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      // type: String,
      required: [true, "Project ID is required"],
      index: true,
      ref: "ArchiveProject", // Reference to ArchiveProject model
    },
    queryTitle: {
      type: String,
      required: [true, "Query title is required"],
      minlength: [5, "Query title must be at least 5 characters"],
      maxlength: [200, "Query title cannot exceed 200 characters"],
      trim: true,
      index: true,
    },
    queryDescription: {
      type: String,
      required: [true, "Query description is required"],
      minlength: [20, "Query description must be at least 20 characters"],
      maxlength: [2000, "Query description cannot exceed 2000 characters"],
      trim: true,
    },
    queryCategory: {
      type: String,
      required: [true, "Query category is required"],
      enum: {
        values: [
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
        ],
        message: "Invalid query category",
      },
      index: true,
    },
    priority: {
      type: String,
      required: [true, "Priority is required"],
      enum: {
        values: ["Low", "Medium", "High", "Urgent"],
        message: "Priority must be Low, Medium, High, or Urgent",
      },
      default: "Medium",
      index: true,
    },
    status: {
      type: String,
      // required: [true, "Status is required"],
      enum: {
        values: [
          "Open",
          "In Progress",
          "Under Review",
          "Resolved",
          "Closed",
          "Escalated",
        ],
        message: "Invalid status",
      },
      default: "Open",
      index: true,
    },
    raisedBy: {
      type: String,
      required: [true, "Raised by field is required"],
      trim: true,
      index: true,
    },
    assignedTo: {
      type: String,
      trim: true,
      index: true,
    },
    raisedDate: {
      type: Date,
      required: [true, "Raised date is required"],
      default: Date.now,
      index: true,
    },
    expectedResolutionDate: {
      type: Date,
      required: [true, "Expected resolution date is required"],
    },
    actualResolutionDate: {
      type: Date,
    },
    queryResponse: {
      type: String,
      maxlength: [2000, "Query response cannot exceed 2000 characters"],
      trim: true,
    },
    internalRemarks: {
      type: String,
      maxlength: [1000, "Internal remarks cannot exceed 1000 characters"],
      trim: true,
    },
    escalationLevel: {
      type: Number,
      min: [0, "Escalation level cannot be negative"],
      max: [5, "Escalation level cannot exceed 5"],
      default: 0,
    },
    relatedQueries: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "RaisedQuery",
      },
    ],
    attachmentReferences: [String], // Store file names/paths if needed later
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const archiveProjectSchema = new mongoose.Schema(
  {
    projectId: {
      type: String,
      required: [true, "Project ID is required"],
      unique: true,
      index: true,
    },
    financialYear: {
      type: String,
      required: [true, "Financial year is required"],
      match: [/^\d{4}-\d{4}$/, "Financial year must be in YYYY-YYYY format"],
      index: true,
    },
    AANumber: {
      type: String,
      required: [true, "A.A no. is required"],
      trim: true,
      index: true,
    },
    AAAmount: {
      type: Number,
      required: [true, "A.A amount is required"],
      min: [0, "A.A amount must be positive"],
    },
    AADated: {
      type: Date,
      required: [true, "A.A date is required"],
    },
    nameOfWork: {
      type: String,
      required: [true, "Name of work is required"],
      minlength: [10, "Project name must be at least 10 characters"],
      maxlength: [200, "Project name cannot exceed 200 characters"],
      trim: true,
      index: true,
    },
    nameOfContractor: {
      type: String,
      required: [true, "Name of contractor is required"],
      minlength: [8, "Contractor name must be at least 8 characters"],
      maxlength: [100, "Contractor name cannot exceed 100 characters"],
      trim: true,
      index: true,
    },
    workValue: {
      type: Number,
      required: [true, "Work value is required"],
      min: [0, "Work value must be positive"],
    },
    FWONumberAndDate: {
      type: String,
      trim: true,
    },
    FWODate: {
      type: Date,
    },

    // Physical/Work Progress
    progress: {
      type: Number,
      min: [0, "Progress cannot be negative"],
      max: [100, "Progress cannot exceed 100%"],
      default: 0,
    },

    // Financial Progress
    financialProgress: {
      type: Number,
      min: [0, "Financial progress cannot be negative"],
      max: [100, "Financial progress cannot exceed 100%"],
      default: 0,
    },

    billSubmittedAmount: {
      type: Number,
      min: [0, "Bill submitted amount cannot be negative"],
      required: [true, "Bill submitted amount is required"],
      default: 0,
    },
    location: {
      type: String,
      trim: true,
      required: [true, "Location is required"],
      minlength: [3, "Location must be at least 3 characters"],
      maxlength: [100, "Location cannot exceed 100 characters"],
      index: true,
    },
    billNumber: {
      type: String,
      required: [true, "Bill number is required"],
      trim: true,
    },
    concernedEngineer: {
      type: String,
      required: [true, "Concerned engineer is required"],
      trim: true,
      index: true,
    },
    remarks: {
      type: String,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
      trim: true,
    },

    // Progress updates (physical/work progress)
    progressUpdates: [progressUpdateSchema],

    // Financial progress updates
    financialProgressUpdates: [financialProgressUpdateSchema],

    // Queries related to the project
    queries: [raisedQuerySchema],

    // Track last updates
    lastProgressUpdate: {
      type: Date,
      default: null,
    },
    lastFinancialProgressUpdate: {
      type: Date,
      default: null,
    },

    // Track if updates are enabled
    progressUpdatesEnabled: {
      type: Boolean,
      default: true,
    },
    financialProgressUpdatesEnabled: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Existing indexes
archiveProjectSchema.index({ financialYear: 1, concernedEngineer: 1 });
archiveProjectSchema.index({ financialYear: 1, nameOfContractor: 1 });
archiveProjectSchema.index({ financialYear: 1, location: 1 });
archiveProjectSchema.index({ concernedEngineer: 1, progress: 1 });
archiveProjectSchema.index({ workValue: -1, financialYear: 1 });
archiveProjectSchema.index({ FWODate: -1 });
archiveProjectSchema.index({ AADated: -1 });
archiveProjectSchema.index({ createdAt: -1 });

// New indexes for progress updates
archiveProjectSchema.index({ "progressUpdates.createdAt": -1 });
archiveProjectSchema.index({ "financialProgressUpdates.createdAt": -1 });
archiveProjectSchema.index({ lastProgressUpdate: -1 });
archiveProjectSchema.index({ lastFinancialProgressUpdate: -1 });
archiveProjectSchema.index({ financialProgress: 1 });
archiveProjectSchema.index({ progress: 1, financialProgress: 1 });

// Text Index for searching
archiveProjectSchema.index({
  nameOfWork: "text",
  nameOfContractor: "text",
  location: "text",
  remarks: "text",
});

// Existing virtuals
archiveProjectSchema.virtual("remainingWorkValue").get(function () {
  if (this.billSubmittedAmount && this.workValue) {
    return this.workValue - this.billSubmittedAmount;
  }
  return this.workValue;
});

archiveProjectSchema.virtual("progressStatus").get(function () {
  if (!this.progress) return "Not Started";
  if (this.progress < 25) return "Just Started";
  if (this.progress < 50) return "In Progress";
  if (this.progress < 75) return "Halfway Complete";
  if (this.progress < 100) return "Near Completion";
  return "Completed";
});

// New virtuals for financial progress
archiveProjectSchema.virtual("financialProgressStatus").get(function () {
  if (!this.financialProgress) return "Not Started";
  if (this.financialProgress < 25) return "Just Started";
  if (this.financialProgress < 50) return "In Progress";
  if (this.financialProgress < 75) return "Halfway Complete";
  if (this.financialProgress < 100) return "Near Completion";
  return "Completed";
});

archiveProjectSchema.virtual("remainingBillAmount").get(function () {
  if (this.workValue && this.billSubmittedAmount) {
    return this.workValue - this.billSubmittedAmount;
  }
  return this.workValue;
});

archiveProjectSchema.virtual("progressSummary").get(function () {
  return {
    physical: {
      percentage: this.progress,
      status: this.progressStatus,
      lastUpdate: this.lastProgressUpdate,
    },
    financial: {
      percentage: this.financialProgress,
      status: this.financialProgressStatus,
      lastUpdate: this.lastFinancialProgressUpdate,
      amountSubmitted: this.billSubmittedAmount,
      amountRemaining: this.remainingBillAmount,
    },
  };
});

// Progress update virtuals
archiveProjectSchema.virtual("totalProgressUpdates").get(function () {
  return this.progressUpdates ? this.progressUpdates.length : 0;
});

archiveProjectSchema.virtual("totalFinancialProgressUpdates").get(function () {
  return this.financialProgressUpdates
    ? this.financialProgressUpdates.length
    : 0;
});

archiveProjectSchema.virtual("latestProgressUpdate").get(function () {
  if (this.progressUpdates && this.progressUpdates.length > 0) {
    return this.progressUpdates[this.progressUpdates.length - 1];
  }
  return null;
});

archiveProjectSchema.virtual("latestFinancialProgressUpdate").get(function () {
  if (
    this.financialProgressUpdates &&
    this.financialProgressUpdates.length > 0
  ) {
    return this.financialProgressUpdates[
      this.financialProgressUpdates.length - 1
    ];
  }
  return null;
});

// Pre-save middleware
archiveProjectSchema.pre("save", function (next) {
  if (
    this.billSubmittedAmount &&
    this.workValue &&
    this.billSubmittedAmount > this.workValue
  ) {
    next(new Error("Bill submitted amount cannot exceed work value"));
  }

  if (this.AADated > new Date()) {
    next(new Error("A.A date cannot be in the future"));
  }

  // Auto-calculate financial progress based on bill amount
  if (this.workValue > 0) {
    this.financialProgress = Math.round(
      (this.billSubmittedAmount / this.workValue) * 100
    );
  }

  next();
});

// Static methods
archiveProjectSchema.statics.findByFinancialYear = function (year) {
  return this.find({ financialYear: year });
};

archiveProjectSchema.statics.findByEngineer = function (
  engineerName,
  page = 1,
  limit = 10
) {
  const skip = (page - 1) * limit;
  return this.find({ concernedEngineer: engineerName })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Progress update statistics
archiveProjectSchema.statics.getProgressUpdateStats = function (filter = {}) {
  return this.aggregate([
    { $match: filter },
    { $unwind: "$progressUpdates" },
    {
      $group: {
        _id: null,
        totalUpdates: { $sum: 1 },
        avgProgressIncrease: { $avg: "$progressUpdates.progressDifference" },
        maxProgressIncrease: { $max: "$progressUpdates.progressDifference" },
        minProgressIncrease: { $min: "$progressUpdates.progressDifference" },
        totalFilesUploaded: {
          $sum: { $size: "$progressUpdates.supportingDocuments" },
        },
      },
    },
  ]);
};

// Financial progress update statistics
archiveProjectSchema.statics.getFinancialProgressUpdateStats = function (
  filter = {}
) {
  return this.aggregate([
    { $match: filter },
    { $unwind: "$financialProgressUpdates" },
    {
      $group: {
        _id: null,
        totalUpdates: { $sum: 1 },
        avgProgressIncrease: {
          $avg: "$financialProgressUpdates.progressDifference",
        },
        avgAmountIncrease: {
          $avg: "$financialProgressUpdates.amountDifference",
        },
        totalAmountSubmitted: {
          $sum: "$financialProgressUpdates.amountDifference",
        },
        maxProgressIncrease: {
          $max: "$financialProgressUpdates.progressDifference",
        },
        minProgressIncrease: {
          $min: "$financialProgressUpdates.progressDifference",
        },
        totalFilesUploaded: {
          $sum: { $size: "$financialProgressUpdates.supportingDocuments" },
        },
      },
    },
  ]);
};

// Instance methods
archiveProjectSchema.methods.calculateFinancialProgress = function () {
  if (!this.billSubmittedAmount || !this.workValue) return 0;
  return Math.round((this.billSubmittedAmount / this.workValue) * 100);
};

// Add progress update method
archiveProjectSchema.methods.addProgressUpdate = function (
  updateData,
  userInfo
) {
  const previousProgress = this.progress;
  const newProgress = updateData.newProgress;
  const progressDifference = newProgress - previousProgress;

  const progressUpdate = {
    previousProgress,
    newProgress,
    progressDifference,
    remarks: updateData.remarks,
    supportingDocuments: updateData.supportingDocuments || [],
    updatedBy: {
      userId: userInfo.userId,
      userName: userInfo.userName,
      userDesignation: userInfo.userDesignation,
    },
    ipAddress: updateData.ipAddress,
    userAgent: updateData.userAgent,
  };

  this.progressUpdates.push(progressUpdate);
  this.progress = newProgress;
  this.lastProgressUpdate = new Date();

  return this.save();
};

// Add financial progress update method
archiveProjectSchema.methods.addFinancialProgressUpdate = function (
  updateData,
  userInfo
) {
  const previousFinancialProgress = this.financialProgress;
  const previousBillAmount = this.billSubmittedAmount;

  const newBillAmount = updateData.newBillAmount;
  const newFinancialProgress =
    this.workValue > 0 ? Math.round((newBillAmount / this.workValue) * 100) : 0;

  const progressDifference = newFinancialProgress - previousFinancialProgress;
  const amountDifference = newBillAmount - previousBillAmount;

  const financialProgressUpdate = {
    previousFinancialProgress,
    newFinancialProgress,
    progressDifference,
    previousBillAmount,
    newBillAmount,
    amountDifference,
    remarks: updateData.remarks,
    billDetails: updateData.billDetails || {},
    supportingDocuments: updateData.supportingDocuments || [],
    updatedBy: {
      userId: userInfo.userId,
      userName: userInfo.userName,
      userDesignation: userInfo.userDesignation,
    },
    ipAddress: updateData.ipAddress,
    userAgent: updateData.userAgent,
  };

  this.financialProgressUpdates.push(financialProgressUpdate);
  this.billSubmittedAmount = newBillAmount;
  this.financialProgress = newFinancialProgress;
  this.lastFinancialProgressUpdate = new Date();

  // Update bill number if provided
  if (updateData.billDetails && updateData.billDetails.billNumber) {
    this.billNumber = updateData.billDetails.billNumber;
  }

  return this.save();
};

// Get progress update history
archiveProjectSchema.methods.getProgressUpdateHistory = function (
  page = 1,
  limit = 10
) {
  const skip = (page - 1) * limit;
  const updates = this.progressUpdates
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(skip, skip + limit);

  return {
    updates,
    totalUpdates: this.progressUpdates.length,
    currentPage: page,
    totalPages: Math.ceil(this.progressUpdates.length / limit),
    hasNextPage: page < Math.ceil(this.progressUpdates.length / limit),
    hasPrevPage: page > 1,
  };
};

// Get financial progress update history
archiveProjectSchema.methods.getFinancialProgressUpdateHistory = function (
  page = 1,
  limit = 10
) {
  const skip = (page - 1) * limit;
  const updates = this.financialProgressUpdates
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(skip, skip + limit);

  return {
    updates,
    totalUpdates: this.financialProgressUpdates.length,
    currentPage: page,
    totalPages: Math.ceil(this.financialProgressUpdates.length / limit),
    hasNextPage: page < Math.ceil(this.financialProgressUpdates.length / limit),
    hasPrevPage: page > 1,
  };
};
// Compound Indexes for common query patterns
raisedQuerySchema.index({ projectId: 1, status: 1 }); // Project queries by status
raisedQuerySchema.index({ raisedBy: 1, status: 1 }); // User's queries by status
raisedQuerySchema.index({ assignedTo: 1, priority: 1 }); // Assigned queries by priority
raisedQuerySchema.index({ queryCategory: 1, status: 1 }); // Category-wise queries
raisedQuerySchema.index({ raisedDate: -1, priority: 1 }); // Recent queries by priority
raisedQuerySchema.index({ expectedResolutionDate: 1, status: 1 }); // Due queries
raisedQuerySchema.index({ projectId: 1, raisedDate: -1 }); // Project queries timeline
raisedQuerySchema.index({ status: 1, escalationLevel: -1 }); // Escalated queries

// Text Index for searching across text fields
raisedQuerySchema.index({
  queryTitle: "text",
  queryDescription: "text",
  queryResponse: "text",
  internalRemarks: "text",
});

// Virtual for calculating days since raised
raisedQuerySchema.virtual("daysSinceRaised").get(function () {
  if (!this.raisedDate) return 0;
  const now = new Date();
  const diffTime = Math.abs(now - this.raisedDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for calculating days until due
raisedQuerySchema.virtual("daysUntilDue").get(function () {
  if (!this.expectedResolutionDate) return null;
  const now = new Date();
  const diffTime = this.expectedResolutionDate - now;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Virtual for checking if query is overdue
raisedQuerySchema.virtual("isOverdue").get(function () {
  if (
    !this.expectedResolutionDate ||
    this.status === "Resolved" ||
    this.status === "Closed"
  ) {
    return false;
  }
  return new Date() > this.expectedResolutionDate;
});

// Virtual for resolution time (in days)
raisedQuerySchema.virtual("resolutionTimeInDays").get(function () {
  if (!this.actualResolutionDate || !this.raisedDate) return null;
  const diffTime = Math.abs(this.actualResolutionDate - this.raisedDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Pre-save middleware for validation and auto-updates
raisedQuerySchema.pre("save", function (next) {
  // Auto-set actualResolutionDate when status changes to Resolved or Closed
  if (
    (this.status === "Resolved" || this.status === "Closed") &&
    !this.actualResolutionDate
  ) {
    this.actualResolutionDate = new Date();
  }

  // Ensure expected resolution date is not in the past (only for new queries)
  if (this.isNew && this.expectedResolutionDate < new Date()) {
    next(new Error("Expected resolution date cannot be in the past"));
  }

  // Auto-escalate if query is overdue and still open
  if (
    this.expectedResolutionDate < new Date() &&
    ["Open", "In Progress"].includes(this.status) &&
    this.escalationLevel < 3
  ) {
    this.escalationLevel += 1;
  }

  next();
});

// Static Methods for CRUD operations

// CREATE - Create a new query
raisedQuerySchema.statics.createQuery = async function (queryData) {
  try {
    // Generate unique queryId if not provided
    if (!queryData.queryId) {
      const count = await this.countDocuments();
      const year = new Date().getFullYear();
      queryData.queryId = `QRY-${year}-${String(count + 1).padStart(4, "0")}`;
    }

    const query = new this(queryData);
    await query.save();
    return {
      success: true,
      data: query,
      message: "Query created successfully",
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// READ - Get queries with filters and pagination
raisedQuerySchema.statics.getQueries = async function (
  filters = {},
  options = {}
) {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "raisedDate",
      sortOrder = -1,
      populate = false,
    } = options;

    const skip = (page - 1) * limit;
    let query = this.find(filters)
      .sort({ [sortBy]: sortOrder })
      .skip(skip)
      .limit(limit);

    if (populate) {
      query = query.populate("relatedQueries", "queryId queryTitle status");
    }

    const queries = await query;
    const total = await this.countDocuments(filters);

    return {
      success: true,
      data: {
        queries,
        pagination: {
          current: page,
          pages: Math.ceil(total / limit),
          total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1,
        },
      },
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// READ - Get single query by ID
raisedQuerySchema.statics.getQueryById = async function (queryId) {
  try {
    const query = await this.findOne({ queryId }).populate(
      "relatedQueries",
      "queryId queryTitle status"
    );

    if (!query) {
      return { success: false, error: "Query not found" };
    }

    return { success: true, data: query };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// UPDATE - Update query
raisedQuerySchema.statics.updateQuery = async function (queryId, updateData) {
  try {
    const query = await this.findOneAndUpdate(
      { queryId },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!query) {
      return { success: false, error: "Query not found" };
    }

    return {
      success: true,
      data: query,
      message: "Query updated successfully",
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// DELETE - Soft delete (mark as inactive)
raisedQuerySchema.statics.deleteQuery = async function (queryId) {
  try {
    const query = await this.findOneAndUpdate(
      { queryId },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!query) {
      return { success: false, error: "Query not found" };
    }

    return { success: true, message: "Query deleted successfully" };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Additional utility static methods

// Get queries by project
raisedQuerySchema.statics.getQueriesByProject = function (
  projectId,
  page = 1,
  limit = 10
) {
  return this.getQueries({ projectId, isActive: true }, { page, limit });
};

// Get queries by user
raisedQuerySchema.statics.getQueriesByUser = function (
  raisedBy,
  page = 1,
  limit = 10
) {
  return this.getQueries({ raisedBy, isActive: true }, { page, limit });
};

// Get overdue queries
raisedQuerySchema.statics.getOverdueQueries = function (page = 1, limit = 10) {
  const filters = {
    expectedResolutionDate: { $lt: new Date() },
    status: { $in: ["Open", "In Progress", "Under Review"] },
    isActive: true,
  };
  return this.getQueries(filters, {
    page,
    limit,
    sortBy: "expectedResolutionDate",
  });
};

// Get queries by status
raisedQuerySchema.statics.getQueriesByStatus = function (
  status,
  page = 1,
  limit = 10
) {
  return this.getQueries({ status, isActive: true }, { page, limit });
};

// Get queries by priority
raisedQuerySchema.statics.getQueriesByPriority = function (
  priority,
  page = 1,
  limit = 10
) {
  return this.getQueries({ priority, isActive: true }, { page, limit });
};

// Search queries
raisedQuerySchema.statics.searchQueries = function (
  searchTerm,
  page = 1,
  limit = 10
) {
  const filters = {
    $text: { $search: searchTerm },
    isActive: true,
  };
  return this.getQueries(filters, {
    page,
    limit,
    sortBy: "score",
    sortOrder: { $meta: "textScore" },
  });
};

// Instance Methods

// Assign query to user
raisedQuerySchema.methods.assignTo = async function (
  assignedTo,
  assignedToDepartment
) {
  this.assignedTo = assignedTo;
  this.assignedToDepartment = assignedToDepartment;
  this.status = "In Progress";
  return await this.save();
};

// Update query status
raisedQuerySchema.methods.updateStatus = async function (
  newStatus,
  remarks = ""
) {
  this.status = newStatus;
  if (remarks) {
    this.internalRemarks = this.internalRemarks
      ? `${this.internalRemarks}\n[${new Date().toISOString()}] ${remarks}`
      : `[${new Date().toISOString()}] ${remarks}`;
  }

  if (newStatus === "Resolved" || newStatus === "Closed") {
    this.actualResolutionDate = new Date();
  }

  return await this.save();
};

// Add response to query
raisedQuerySchema.methods.addResponse = async function (response) {
  this.queryResponse = response;
  this.status = "Resolved";
  this.actualResolutionDate = new Date();
  return await this.save();
};

// Escalate query
raisedQuerySchema.methods.escalate = async function (reason = "") {
  this.escalationLevel += 1;
  this.status = "Escalated";

  const escalationNote = `[ESCALATED - Level ${this.escalationLevel}] ${reason}`;
  this.internalRemarks = this.internalRemarks
    ? `${this.internalRemarks}\n[${new Date().toISOString()}] ${escalationNote}`
    : `[${new Date().toISOString()}] ${escalationNote}`;

  return await this.save();
};

const ArchiveProject = mongoose.model("ArchiveProject", archiveProjectSchema);

export default ArchiveProject;
