import mongoose from "mongoose";

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
      index: true, // Added index for frequent queries
    },
    AANumber: {
      type: String,
      required: [true, "A.A no. is required"],
      trim: true,
      index: true, // Added index for administrative approval lookups
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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound Indexes for common query patterns
archiveProjectSchema.index({ financialYear: 1, concernedEngineer: 1 }); // Projects by year and engineer
archiveProjectSchema.index({ financialYear: 1, nameOfContractor: 1 }); // Projects by year and contractor
archiveProjectSchema.index({ financialYear: 1, location: 1 }); // Projects by year and location
archiveProjectSchema.index({ concernedEngineer: 1, progress: 1 }); // Engineer's projects by progress
archiveProjectSchema.index({ workValue: -1, financialYear: 1 }); // High-value projects by year
archiveProjectSchema.index({ FWODate: -1 }); // Recent FWO orders
archiveProjectSchema.index({ AADated: -1 }); // Recent administrative approvals
archiveProjectSchema.index({ createdAt: -1 }); // Recently created records

// Text Index for searching across multiple text fields
archiveProjectSchema.index({
  nameOfWork: "text",
  nameOfContractor: "text",
  location: "text",
  remarks: "text",
});

// Virtual for calculating remaining work value
archiveProjectSchema.virtual("remainingWorkValue").get(function () {
  if (this.billSubmittedAmount && this.workValue) {
    return this.workValue - this.billSubmittedAmount;
  }
  return this.workValue;
});

// Virtual for progress status
archiveProjectSchema.virtual("progressStatus").get(function () {
  if (!this.progress) return "Not Started";
  if (this.progress < 25) return "Just Started";
  if (this.progress < 50) return "In Progress";
  if (this.progress < 75) return "Halfway Complete";
  if (this.progress < 100) return "Near Completion";
  return "Completed";
});

// Pre-save middleware to ensure data consistency
archiveProjectSchema.pre("save", function (next) {
  // Ensure bill submitted amount doesn't exceed work value
  if (
    this.billSubmittedAmount &&
    this.workValue &&
    this.billSubmittedAmount > this.workValue
  ) {
    next(new Error("Bill submitted amount cannot exceed work value"));
  }

  // Ensure AA date is not in the future
  if (this.AADated > new Date()) {
    next(new Error("A.A date cannot be in the future"));
  }

  next();
});

// Static method to find projects by financial year
archiveProjectSchema.statics.findByFinancialYear = function (year) {
  return this.find({ financialYear: year });
};

// Static method to find projects by engineer with pagination
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

// Instance method to calculate completion percentage based on bill amount
archiveProjectSchema.methods.calculateFinancialProgress = function () {
  if (!this.billSubmittedAmount || !this.workValue) return 0;
  return Math.round((this.billSubmittedAmount / this.workValue) * 100);
};

const ArchiveProject = mongoose.model("ArchiveProject", archiveProjectSchema);

export default ArchiveProject;
