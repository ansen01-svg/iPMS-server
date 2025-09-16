import mongoose from "mongoose";
import {
  districts,
  funds,
  projectStatus,
  sanctionAndDepartment,
  typeOfWork,
} from "../utils/constants.js";

// Helper function to get all sub funds
const getAllSubFunds = () => {
  return funds.flatMap((fund) => fund.subFunds.map((subFund) => subFund.name));
};

// Helper function to validate sub fund belongs to main fund
const validateSubFundForMainFund = function (subFundName) {
  if (!subFundName || !this.fund) return true; // Skip validation if either is empty

  const mainFund = funds.find((fund) => fund.name === this.fund);
  if (!mainFund) return false;

  return mainFund.subFunds.some((subFund) => subFund.name === subFundName);
};

// Schema for tracking status changes
const statusHistorySchema = new mongoose.Schema(
  {
    previousStatus: {
      type: String,
      enum: [
        "Submitted for Approval",
        "Resubmitted for Approval",
        "Rejected by AEE",
        "Rejected by CE",
        "Rejected by MD",
        "Ongoing",
        "Completed",
      ],
      required: true,
    },
    newStatus: {
      type: String,
      enum: [
        "Submitted for Approval",
        "Resubmitted for Approval",
        "Rejected by AEE",
        "Rejected by CE",
        "Rejected by MD",
        "Ongoing",
        "Completed",
      ],
      required: true,
    },
    changedBy: {
      userId: {
        type: String,
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
      role: {
        type: String,
        required: true,
        enum: ["JE", "AEE", "CE", "MD"],
      },
    },
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [1000, "Rejection reason cannot exceed 1000 characters"],
      // Only required for rejection statuses
      required: function () {
        return this.newStatus.includes("Rejected");
      },
    },
    ipAddress: String,
    userAgent: String,
  },
  {
    timestamps: true,
  }
);

// Schema for raise query
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
      required: [true, "Project ID is required"],
      index: true,
      ref: "Project", // Reference to Project model
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
    // Project details
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

    // Funds
    fund: {
      type: String,
      enum: {
        values: funds.map((fund) => fund.name),
        message: "Invalid fund type",
      },
      required: [true, "Fund is required"],
      index: true,
    },
    subFund: {
      type: String,
      enum: {
        values: getAllSubFunds(),
        message: "Invalid sub fund type",
      },
      required: [true, "Sub fund is required"],
      validate: {
        validator: validateSubFundForMainFund,
        message: "Sub fund must belong to the selected main fund",
      },
      index: true,
    },
    sanctioningDepartment: {
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

    // Contractor details
    contractorName: {
      type: String,
      required: [true, "Contractor name is required"],
      trim: true,
      minlength: [2, "Contractor name must be at least 2 characters"],
      maxlength: [100, "Contractor name cannot exceed 100 characters"],
      index: true,
    },
    contractorAddress: {
      type: String,
      required: [true, "Contractor address is required"],
      trim: true,
      minlength: [10, "Contractor address must be at least 10 characters"],
      maxlength: [500, "Contractor address cannot exceed 500 characters"],
    },
    contractorPhoneNumber: {
      type: String,
      required: [true, "Contractor phone number is required"],
      trim: true,
      validate: {
        validator: function (v) {
          // Indian phone number validation (10 digits, can start with +91)
          return /^(\+91[\s-]?)?[6-9]\d{9}$/.test(v.replace(/[\s-]/g, ""));
        },
        message:
          "Please enter a valid Indian phone number (10 digits starting with 6-9)",
      },
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
      default: "Submitted for Approval",
      index: true,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
    },
    // Track status workflow
    statusWorkflow: {
      submittedAt: Date,
      approvedAt: Date,
      rejectedAt: Date,
      completedAt: Date,
      approvedBy: {
        userId: String,
        name: String,
        role: String,
      },
      rejectedBy: {
        userId: String,
        name: String,
        role: String,
      },
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

    // Queries related to the project
    queries: [raisedQuerySchema],
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
projectSchema.index({ fund: 1, subFund: 1 });
projectSchema.index({ district: 1, fund: 1, subFund: 1 });
projectSchema.index({ subFund: 1, status: 1 });

projectSchema.index({ "statusHistory.newStatus": 1 });
projectSchema.index({ "statusHistory.changedBy.userId": 1 });
projectSchema.index({ "statusHistory.createdAt": -1 });
projectSchema.index({ "statusWorkflow.approvedAt": -1 });
projectSchema.index({ "statusWorkflow.rejectedAt": -1 });

// Text Index for searching
projectSchema.index({
  projectName: "text",
  description: "text",
  beneficiary: "text",
});

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

// Virtual to get fund and sub fund info together:
projectSchema.virtual("fundDetails").get(function () {
  const mainFund = funds.find((fund) => fund.name === this.fund);
  if (!mainFund) return null;

  const subFund = mainFund.subFunds.find((sf) => sf.name === this.subFund);

  return {
    mainFund: {
      name: mainFund.name,
      code: mainFund.code,
    },
    subFund: subFund
      ? {
          name: subFund.name,
          code: subFund.code,
        }
      : null,
    fullName: subFund ? `${mainFund.name} - ${subFund.name}` : mainFund.name,
    fullCode: subFund ? `${mainFund.code}-${subFund.code}` : mainFund.code,
  };
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

projectSchema.virtual("totalQueries").get(function () {
  return this.queries ? this.queries.filter((q) => q.isActive).length : 0;
});

// Virtual for open queries
projectSchema.virtual("openQueries").get(function () {
  return this.queries
    ? this.queries.filter((q) => q.isActive && q.status === "Open").length
    : 0;
});

// Virtual for overdue queries
projectSchema.virtual("overdueQueries").get(function () {
  if (!this.queries) return 0;
  const now = new Date();
  return this.queries.filter(
    (q) =>
      q.isActive &&
      q.expectedResolutionDate < now &&
      !["Resolved", "Closed"].includes(q.status)
  ).length;
});

// Virtual for latest query
projectSchema.virtual("latestQuery").get(function () {
  if (!this.queries || this.queries.length === 0) return null;
  const activeQueries = this.queries.filter((q) => q.isActive);
  if (activeQueries.length === 0) return null;
  return activeQueries.sort((a, b) => b.raisedDate - a.raisedDate)[0];
});

// Instance method to add a query
projectSchema.methods.addQuery = function (queryData, userInfo) {
  // Generate unique queryId
  const year = new Date().getFullYear();
  const queryCount = this.queries ? this.queries.length : 0;
  const queryId = `QRY-${year}-${String(queryCount + 1).padStart(4, "0")}`;

  const newQuery = {
    queryId,
    projectId: this._id,
    queryTitle: queryData.queryTitle.trim(),
    queryDescription: queryData.queryDescription.trim(),
    queryCategory: queryData.queryCategory,
    priority: queryData.priority || "Medium",
    status: "Open",
    raisedBy: userInfo.name || userInfo.username,
    assignedTo: queryData.assignedTo?.trim() || "",
    raisedDate: new Date(),
    expectedResolutionDate: new Date(queryData.expectedResolutionDate),
    escalationLevel: 0,
    isActive: true,
  };

  this.queries.push(newQuery);
  return this.save();
};

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

// Static method to find projects by fund and sub fund:
projectSchema.statics.findByFundAndSubFund = function (fundName, subFundName) {
  const query = { fund: fundName };
  if (subFundName) {
    query.subFund = subFundName;
  }
  return this.find(query);
};

// Static method to get sub funds for a main fund:
projectSchema.statics.getSubFundsForMainFund = function (mainFundName) {
  const mainFund = funds.find((fund) => fund.name === mainFundName);
  return mainFund ? mainFund.subFunds : [];
};

// Method to change project status
projectSchema.methods.changeStatus = function (
  newStatus,
  userInfo,
  remarks = "",
  rejectionReason = ""
) {
  const previousStatus = this.status;

  // Validate status transition based on user role
  const allowedTransitions = this.validateStatusTransition(
    newStatus,
    userInfo.role
  );
  if (!allowedTransitions.isValid) {
    throw new Error(allowedTransitions.message);
  }

  // Create status history entry
  const statusHistoryEntry = {
    previousStatus,
    newStatus,
    changedBy: {
      userId: userInfo.userId,
      name: userInfo.name,
      role: userInfo.role,
    },
    remarks,
    rejectionReason: newStatus.includes("Rejected")
      ? rejectionReason
      : undefined,
    ipAddress: userInfo.ipAddress,
    userAgent: userInfo.userAgent,
  };

  // Update status and history
  this.status = newStatus;
  this.statusHistory.push(statusHistoryEntry);

  // Update workflow timestamps
  this.updateStatusWorkflow(newStatus, userInfo);

  return this.save();
};

// Method to validate status transitions based on user role
projectSchema.methods.validateStatusTransition = function (
  newStatus,
  userRole
) {
  const currentStatus = this.status;

  // Define allowed transitions for each role
  const allowedTransitions = {
    JE: {
      "Rejected by AEE": ["Resubmitted for Approval"],
      "Rejected by CE": ["Resubmitted for Approval"],
      "Rejected by MD": ["Resubmitted for Approval"],
      Ongoing: ["Completed"],
    },
    AEE: {
      "Submitted for Approval": ["Rejected by AEE", "Ongoing"],
      "Resubmitted for Approval": ["Rejected by AEE", "Ongoing"],
    },
    CE: {
      "Submitted for Approval": ["Rejected by CE", "Ongoing"],
      "Resubmitted for Approval": ["Rejected by CE", "Ongoing"],
    },
    MD: {
      "Submitted for Approval": ["Rejected by MD", "Ongoing"],
      "Resubmitted for Approval": ["Rejected by MD", "Ongoing"],
    },
  };

  const userAllowedTransitions = allowedTransitions[userRole];

  if (!userAllowedTransitions || !userAllowedTransitions[currentStatus]) {
    return {
      isValid: false,
      message: `${userRole} is not authorized to change status from '${currentStatus}'`,
    };
  }

  if (!userAllowedTransitions[currentStatus].includes(newStatus)) {
    return {
      isValid: false,
      message: `Invalid status transition from '${currentStatus}' to '${newStatus}' for ${userRole}`,
    };
  }

  return { isValid: true };
};

// Method to update workflow timestamps
projectSchema.methods.updateStatusWorkflow = function (newStatus, userInfo) {
  const now = new Date();

  switch (newStatus) {
    case "Submitted for Approval":
    case "Resubmitted for Approval":
      this.statusWorkflow.submittedAt = now;
      break;

    case "Ongoing":
      this.statusWorkflow.approvedAt = now;
      this.statusWorkflow.approvedBy = {
        userId: userInfo.userId,
        name: userInfo.name,
        role: userInfo.role,
      };
      break;

    case "Rejected by AEE":
    case "Rejected by CE":
    case "Rejected by MD":
      this.statusWorkflow.rejectedAt = now;
      this.statusWorkflow.rejectedBy = {
        userId: userInfo.userId,
        name: userInfo.name,
        role: userInfo.role,
      };
      break;

    case "Completed":
      this.statusWorkflow.completedAt = now;
      break;
  }
};

// Method to get status history with pagination
projectSchema.methods.getStatusHistory = function (page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  const history = this.statusHistory
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(skip, skip + limit);

  return {
    history,
    totalEntries: this.statusHistory.length,
    currentPage: page,
    totalPages: Math.ceil(this.statusHistory.length / limit),
    hasNextPage: page < Math.ceil(this.statusHistory.length / limit),
    hasPrevPage: page > 1,
  };
};

// Static method to get projects by status
projectSchema.statics.findByStatus = function (status, page = 1, limit = 10) {
  const skip = (page - 1) * limit;
  return this.find({ status })
    .sort({ updatedAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate("statusHistory.changedBy", "name role");
};

// Virtual for current status info
projectSchema.virtual("currentStatusInfo").get(function () {
  const latestHistory =
    this.statusHistory && this.statusHistory.length > 0
      ? this.statusHistory[this.statusHistory.length - 1]
      : null;

  return {
    status: this.status,
    lastChangedAt: latestHistory ? latestHistory.createdAt : this.createdAt,
    lastChangedBy: latestHistory ? latestHistory.changedBy : this.createdBy,
    remarks: latestHistory ? latestHistory.remarks : null,
    isRejected: this.status.includes("Rejected"),
    isApproved: this.status === "Ongoing",
    isCompleted: this.status === "Completed",
    isPending: ["Submitted for Approval", "Resubmitted for Approval"].includes(
      this.status
    ),
  };
});

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
