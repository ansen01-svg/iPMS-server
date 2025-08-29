import mongoose from "mongoose";
import {
  districts,
  funds,
  natureOfWork,
  projectStatus,
  sanctionAndDepartment,
  typeOfWork,
} from "../utils/constants.js";

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

const subProjectSchema = new mongoose.Schema(
  {
    projectName: {
      type: String,
      required: [true, "Sub-project name is required"],
      trim: true,
      minlength: [5, "Sub-project name must be at least 5 characters"],
      maxlength: [100, "Sub-project name cannot exceed 100 characters"],
    },
    estimatedAmount: {
      type: Number,
      required: [true, "Estimated amount is required"],
      min: [0, "Estimated amount cannot be negative"],
    },
    typeOfWork: {
      type: String,
      required: [true, "Type of work is required"],
      trim: true,
      minlength: [3, "Type of work must be at least 3 characters"],
    },
    projectStartDate: {
      type: Date,
      required: [true, "Project start date is required"],
    },
    projectEndDate: {
      type: Date,
      required: [true, "Project end date is required"],
      validate: {
        validator: function (value) {
          return value > this.projectStartDate;
        },
        message: "Project end date must be after start date",
      },
    },
    extensionPeriodForCompletion: {
      type: Date,
      validate: {
        validator: function (value) {
          return !value || value > this.projectEndDate;
        },
        message: "Extension period must be after project end date",
      },
    },
    parentProjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
  },
  { _id: true }
);

const uploadedFilesSchema = new mongoose.Schema(
  {
    fileName: {
      type: String,
      required: [true, "File name is required"],
      trim: true,
      maxlength: [255, "File name cannot exceed 255 characters"],
    },
    fileType: {
      type: String,
      required: [true, "File type is required"],
      enum: ["pdf", "jpg", "jpeg", "png", "doc", "docx", "xls", "xlsx"],
      lowercase: true,
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
      min: [1, "File size must be greater than 0"],
      max: [50 * 1024 * 1024, "File size cannot exceed 50MB"], // 50MB in bytes
    },
    downloadURL: {
      type: String,
      required: [true, "Download URL is required"],
    },
    filePath: {
      type: String,
      required: [true, "File path is required"], // Firebase storage path
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    uploadedBy: {
      userId: String,
      name: String,
    },
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    dateOfIssueOfWorkOrder: {
      type: Date,
      required: [true, "Date of issue of work order is required"],
    },
    projectId: {
      type: String,
      required: [true, "Project ID is required"],
      unique: true,
      index: true,
    },
    projectName: {
      type: String,
      required: [true, "Project name is required"],
      minlength: [5, "Project name must be at least 5 characters"],
      maxlength: [100, "Project name cannot exceed 100 characters"],
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    hasSubProjects: {
      type: Boolean,
      default: false,
    },
    fund: {
      type: String,
      enum: {
        values: funds.map((fund) => fund.name),
        message: "Invalid fund type",
      },
      required: [true, "Fund is required"],
      index: true,
    },
    sanctionAndDepartment: {
      type: String,
      enum: {
        values: sanctionAndDepartment,
        message: "Invalid sanction & department",
      },
      required: [true, "Sanction & Department field is required"],
    },
    budgetHead: {
      type: String,
      trim: true,
      maxlength: [100, "Budget head cannot exceed 100 characters"],
    },
    executingDepartment: {
      type: String,
      default: "APTDCL",
      trim: true,
    },
    beneficiary: {
      type: String,
      trim: true,
      maxlength: [200, "Beneficiary cannot exceed 200 characters"],
    },
    workOrderNumber: {
      type: String,
      required: [true, "Work order number is required"],
      trim: true,
      unique: true,
      index: true,
    },
    estimatedCost: {
      type: Number,
      required: [true, "Estimated cost is required"],
      min: [0, "Estimated cost cannot be negative"],
      index: true,
    },
    typeOfWork: {
      type: String,
      enum: {
        values: typeOfWork,
        message: "Invalid type of work",
      },
      required: [true, "Type of work is required"],
    },
    natureOfWork: {
      type: String,
      enum: {
        values: natureOfWork,
        message: "Invalid nature of work",
      },
      required: [true, "Nature of work is required"],
    },
    projectStartDate: {
      type: Date,
      required: [true, "Project start date is required"],
      index: true,
    },
    projectEndDate: {
      type: Date,
      required: [true, "Project end date is required"],
      validate: {
        validator: function (value) {
          return value > this.projectStartDate;
        },
        message: "Project end date must be after start date",
      },
      index: true,
    },
    extensionPeriodForCompletion: {
      type: Date,
      validate: {
        validator: function (value) {
          return !value || value > this.projectEndDate;
        },
        message: "Extension period must be after project end date",
      },
    },
    district: {
      type: String,
      enum: {
        values: districts,
        message: "Invalid district",
      },
      required: [true, "District is required"],
      index: true,
    },
    block: {
      type: String,
      trim: true,
      maxlength: [50, "Block name cannot exceed 50 characters"],
    },
    gramPanchayat: {
      type: String,
      trim: true,
      maxlength: [50, "Gram Panchayat name cannot exceed 50 characters"],
    },
    subProjects: {
      type: [subProjectSchema],
      default: [],
    },
    uploadedFiles: {
      type: [uploadedFilesSchema],
      default: [],
    },
    geoLocation: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: [true, "Coordinates are required"],
        validate: {
          validator: function (coords) {
            return (
              coords.length === 2 &&
              coords[0] >= -180 &&
              coords[0] <= 180 && // longitude
              coords[1] >= -90 &&
              coords[1] <= 90
            ); // latitude
          },
          message: "Invalid coordinates format [longitude, latitude]",
        },
        index: "2dsphere",
      },
    },

    // ENHANCED: Progress and Financial Tracking
    // Physical/Work Progress
    progressPercentage: {
      type: Number,
      min: [0, "Progress percentage cannot be less than 0"],
      max: [100, "Progress percentage cannot exceed 100"],
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
      default: 0,
    },

    // Progress updates (physical/work progress)
    progressUpdates: [progressUpdateSchema],

    // Financial progress updates
    financialProgressUpdates: [financialProgressUpdateSchema],

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

    // Creator details
    createdBy: {
      userId: {
        type: String,
        required: [true, "Creator user ID is required"],
        index: true,
      },
      name: {
        type: String,
        required: [true, "Creator name is required"],
        trim: true,
      },
      role: {
        type: String,
        required: [true, "Creator role is required"],
        trim: true,
      },
    },

    // Project status
    status: {
      type: String,
      enum: {
        values: projectStatus,
        message: "Invalid project status",
      },
      default: "Submitted to AEE",
      index: true,
    },

    // Additional tracking fields
    lastModifiedBy: {
      userId: String,
      name: String,
      role: String,
      modifiedAt: {
        type: Date,
        default: Date.now,
      },
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Enhanced indexes for better performance
projectSchema.index({ createdBy: 1, status: 1 });
projectSchema.index({ district: 1, status: 1 });
projectSchema.index({ projectStartDate: 1, projectEndDate: 1 });
projectSchema.index({ estimatedCost: 1, fund: 1 });
projectSchema.index({ progressPercentage: 1 });
projectSchema.index({ financialProgress: 1 });
projectSchema.index({ "progressUpdates.createdAt": -1 });
projectSchema.index({ "financialProgressUpdates.createdAt": -1 });
projectSchema.index({ lastProgressUpdate: -1 });
projectSchema.index({ lastFinancialProgressUpdate: -1 });
projectSchema.index({ progressPercentage: 1, financialProgress: 1 });

// Text Index for searching
projectSchema.index({
  projectName: "text",
  description: "text",
  beneficiary: "text",
});

// Virtual for project duration in days
projectSchema.virtual("projectDurationDays").get(function () {
  if (this.projectStartDate && this.projectEndDate) {
    const diffTime = Math.abs(this.projectEndDate - this.projectStartDate);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Virtual for total sub-projects cost
projectSchema.virtual("totalSubProjectsCost").get(function () {
  if (!this.subProjects || !Array.isArray(this.subProjects)) {
    return 0;
  }
  return this.subProjects.reduce(
    (total, sub) => total + (sub.estimatedAmount || 0),
    0
  );
});

// NEW: Progress and Financial Virtuals
projectSchema.virtual("remainingBudget").get(function () {
  if (this.billSubmittedAmount && this.estimatedCost) {
    return this.estimatedCost - this.billSubmittedAmount;
  }
  return this.estimatedCost;
});

projectSchema.virtual("progressStatus").get(function () {
  if (!this.progressPercentage) return "Not Started";
  if (this.progressPercentage < 25) return "Just Started";
  if (this.progressPercentage < 50) return "In Progress";
  if (this.progressPercentage < 75) return "Halfway Complete";
  if (this.progressPercentage < 100) return "Near Completion";
  return "Completed";
});

projectSchema.virtual("financialProgressStatus").get(function () {
  if (!this.financialProgress) return "Not Started";
  if (this.financialProgress < 25) return "Just Started";
  if (this.financialProgress < 50) return "In Progress";
  if (this.financialProgress < 75) return "Halfway Complete";
  if (this.financialProgress < 100) return "Near Completion";
  return "Completed";
});

projectSchema.virtual("progressSummary").get(function () {
  return {
    physical: {
      percentage: this.progressPercentage,
      status: this.progressStatus,
      lastUpdate: this.lastProgressUpdate,
    },
    financial: {
      percentage: this.financialProgress,
      status: this.financialProgressStatus,
      lastUpdate: this.lastFinancialProgressUpdate,
      amountSubmitted: this.billSubmittedAmount,
      amountRemaining: this.remainingBudget,
    },
  };
});

// Progress update virtuals
projectSchema.virtual("totalProgressUpdates").get(function () {
  return this.progressUpdates ? this.progressUpdates.length : 0;
});

projectSchema.virtual("totalFinancialProgressUpdates").get(function () {
  return this.financialProgressUpdates
    ? this.financialProgressUpdates.length
    : 0;
});

projectSchema.virtual("latestProgressUpdate").get(function () {
  if (this.progressUpdates && this.progressUpdates.length > 0) {
    return this.progressUpdates[this.progressUpdates.length - 1];
  }
  return null;
});

projectSchema.virtual("latestFinancialProgressUpdate").get(function () {
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
projectSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.lastModifiedBy.modifiedAt = new Date();
  }

  // Validate bill amount doesn't exceed estimated cost
  if (
    this.billSubmittedAmount &&
    this.estimatedCost &&
    this.billSubmittedAmount > this.estimatedCost
  ) {
    next(new Error("Bill submitted amount cannot exceed estimated cost"));
  }

  // Auto-calculate financial progress based on bill amount
  if (this.estimatedCost > 0) {
    this.financialProgress = Math.round(
      (this.billSubmittedAmount / this.estimatedCost) * 100
    );
  }

  next();
});

// Static methods for finding projects
projectSchema.statics.findByStatus = function (status) {
  return this.find({ status });
};

projectSchema.statics.findByCreator = function (userId, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ "createdBy.userId": userId })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
};

// Progress update statistics
projectSchema.statics.getProgressUpdateStats = function (filter = {}) {
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
projectSchema.statics.getFinancialProgressUpdateStats = function (filter = {}) {
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

// Instance methods for progress tracking
projectSchema.methods.calculateFinancialProgress = function () {
  if (!this.billSubmittedAmount || !this.estimatedCost) return 0;
  return Math.round((this.billSubmittedAmount / this.estimatedCost) * 100);
};

// Add progress update method
projectSchema.methods.addProgressUpdate = function (updateData, userInfo) {
  const previousProgress = this.progressPercentage;
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
  this.progressPercentage = newProgress;
  this.lastProgressUpdate = new Date();

  return this.save();
};

// Add financial progress update method
projectSchema.methods.addFinancialProgressUpdate = function (
  updateData,
  userInfo
) {
  const previousFinancialProgress = this.financialProgress;
  const previousBillAmount = this.billSubmittedAmount;

  const newBillAmount = updateData.newBillAmount;
  const newFinancialProgress =
    this.estimatedCost > 0
      ? Math.round((newBillAmount / this.estimatedCost) * 100)
      : 0;

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

  return this.save();
};

// Get progress update history
projectSchema.methods.getProgressUpdateHistory = function (
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
projectSchema.methods.getFinancialProgressUpdateHistory = function (
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

const Project = mongoose.model("Project", projectSchema);

export default Project;
