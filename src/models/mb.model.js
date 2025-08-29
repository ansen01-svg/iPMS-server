import mongoose from "mongoose";

const measurementBookSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project reference is required"],
      index: true,
    },
    description: {
      type: String,
      required: [true, "MB description is required"],
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },

    // File upload details
    uploadedFile: {
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
