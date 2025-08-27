import mongoose from "mongoose";

// Schema for individual progress updates
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
        filePath: {
          type: String,
          required: true,
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
    progress: {
      type: Number,
      min: [0, "Progress cannot be negative"],
      max: [100, "Progress cannot exceed 100%"],
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

    // Progress updates
    progressUpdates: [progressUpdateSchema],

    // Track last progress update
    lastProgressUpdate: {
      type: Date,
      default: null,
    },

    // Track if project allows progress updates
    progressUpdatesEnabled: {
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
archiveProjectSchema.index({ lastProgressUpdate: -1 });

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

// New virtuals for progress updates
archiveProjectSchema.virtual("totalProgressUpdates").get(function () {
  return this.progressUpdates ? this.progressUpdates.length : 0;
});

archiveProjectSchema.virtual("latestProgressUpdate").get(function () {
  if (this.progressUpdates && this.progressUpdates.length > 0) {
    return this.progressUpdates[this.progressUpdates.length - 1];
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

// New static method for progress update statistics
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

// Instance methods
archiveProjectSchema.methods.calculateFinancialProgress = function () {
  if (!this.billSubmittedAmount || !this.workValue) return 0;
  return Math.round((this.billSubmittedAmount / this.workValue) * 100);
};

// New instance method to add progress update
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

// New instance method to get progress update history with pagination
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

const ArchiveProject = mongoose.model("ArchiveProject", archiveProjectSchema);

export default ArchiveProject;
