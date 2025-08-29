import mongoose from "mongoose";

const measurementBookSchema = new mongoose.Schema(
  {
    // Reference to parent project
    projectId: {
      type: String,
      required: [true, "Project ID is required"],
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project reference is required"],
      index: true,
    },

    // Required fields (minimum 3 as requested)
    title: {
      type: String,
      required: [true, "MB title is required"],
      trim: true,
      minlength: [5, "Title must be at least 5 characters"],
      maxlength: [200, "Title cannot exceed 200 characters"],
      index: true,
    },
    description: {
      type: String,
      required: [true, "MB description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    mbNumber: {
      type: String,
      required: [true, "MB number is required"],
      trim: true,
      maxlength: [50, "MB number cannot exceed 50 characters"],
      index: true,
    },

    // Additional useful fields
    measurementDate: {
      type: Date,
      required: [true, "Measurement date is required"],
      index: true,
    },
    workOrderNumber: {
      type: String,
      trim: true,
      maxlength: [100, "Work order number cannot exceed 100 characters"],
    },
    contractorName: {
      type: String,
      trim: true,
      maxlength: [100, "Contractor name cannot exceed 100 characters"],
    },

    // File upload details
    uploadedFile: {
      fileName: {
        type: String,
        required: [true, "File name is required"],
        trim: true,
        maxlength: [255, "File name cannot exceed 255 characters"],
      },
      originalName: {
        type: String,
        required: [true, "Original file name is required"],
        trim: true,
      },
      fileType: {
        type: String,
        required: [true, "File type is required"],
        enum: ["pdf", "jpg", "jpeg", "png"],
        lowercase: true,
      },
      fileSize: {
        type: Number,
        required: [true, "File size is required"],
        min: [1, "File size must be greater than 0"],
        max: [50 * 1024 * 1024, "File size cannot exceed 50MB"], // 50MB in bytes
      },
      filePath: {
        type: String,
        required: [true, "File path is required"],
      },
      mimeType: {
        type: String,
        required: [true, "MIME type is required"],
      },
    },

    // Status and approval workflow
    status: {
      type: String,
      enum: ["Draft", "Submitted", "Under Review", "Approved", "Rejected"],
      default: "Draft",
      index: true,
    },

    // Creator and modifier info
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

    lastModifiedBy: {
      userId: String,
      name: String,
      role: String,
      modifiedAt: {
        type: Date,
        default: Date.now,
      },
    },

    // Remarks and additional info
    remarks: {
      type: String,
      trim: true,
      maxlength: [500, "Remarks cannot exceed 500 characters"],
    },
    approvedBy: {
      userId: String,
      name: String,
      role: String,
      approvedAt: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
      maxlength: [500, "Rejection reason cannot exceed 500 characters"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
measurementBookSchema.index({ projectId: 1, createdAt: -1 });
measurementBookSchema.index({ projectId: 1, status: 1 });
measurementBookSchema.index({ measurementDate: -1 });
measurementBookSchema.index({ mbNumber: 1, projectId: 1 }, { unique: true });

// Text index for search functionality
measurementBookSchema.index({
  title: "text",
  description: "text",
  contractorName: "text",
  remarks: "text",
});

// Virtual for file URL (you can customize this based on your file serving setup)
measurementBookSchema.virtual("fileUrl").get(function () {
  if (this.uploadedFile && this.uploadedFile.filePath) {
    return `/api/files/${this.uploadedFile.fileName}`;
  }
  return null;
});

// Virtual for human-readable file size
measurementBookSchema.virtual("humanReadableFileSize").get(function () {
  if (!this.uploadedFile || !this.uploadedFile.fileSize) return "0 B";

  const bytes = this.uploadedFile.fileSize;
  const sizes = ["B", "KB", "MB", "GB"];
  if (bytes === 0) return "0 B";

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
});

// Pre-save middleware
measurementBookSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.lastModifiedBy.modifiedAt = new Date();
  }
  next();
});

// Static methods
measurementBookSchema.statics.findByProject = function (
  projectId,
  options = {}
) {
  const {
    page = 1,
    limit = 10,
    status,
    sortBy = "createdAt",
    sortOrder = -1,
  } = options;
  const skip = (page - 1) * limit;

  const query = { projectId };
  if (status) query.status = status;

  return this.find(query)
    .populate("project", "projectName workOrderNumber")
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit);
};

measurementBookSchema.statics.countByProject = function (projectId, status) {
  const query = { projectId };
  if (status) query.status = status;
  return this.countDocuments(query);
};

// Instance methods
measurementBookSchema.methods.approve = function (approverInfo) {
  this.status = "Approved";
  this.approvedBy = {
    userId: approverInfo.userId,
    name: approverInfo.name,
    role: approverInfo.role,
    approvedAt: new Date(),
  };
  return this.save();
};

measurementBookSchema.methods.reject = function (rejectorInfo, reason) {
  this.status = "Rejected";
  this.rejectionReason = reason;
  this.lastModifiedBy = {
    userId: rejectorInfo.userId,
    name: rejectorInfo.name,
    role: rejectorInfo.role,
    modifiedAt: new Date(),
  };
  return this.save();
};

const MeasurementBook = mongoose.model(
  "MeasurementBook",
  measurementBookSchema
);

export default MeasurementBook;
