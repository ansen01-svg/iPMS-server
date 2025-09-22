import mongoose from "mongoose";

const measurementBookSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Project reference is required"],
      index: true,
      // Dynamic reference - will be populated based on projectType
      refPath: "projectType",
    },

    // New field to indicate which model the project belongs to
    projectType: {
      type: String,
      required: [true, "Project type is required"],
      enum: ["Project", "ArchiveProject"],
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

// Updated indexes for better performance
measurementBookSchema.index({ project: 1, projectType: 1, createdAt: -1 });
measurementBookSchema.index({ project: 1, projectType: 1 });
measurementBookSchema.index({ projectType: 1, createdAt: -1 });
measurementBookSchema.index({ "createdBy.userId": 1, projectType: 1 });

// Text index for search functionality
measurementBookSchema.index({
  description: "text",
  remarks: "text",
});

// Virtual for file URL
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
  projectObjectId, // MongoDB ObjectId, not projectId string
  projectType,
  options = {}
) {
  const {
    page = 1,
    limit = 10,
    sortBy = "createdAt",
    sortOrder = -1,
  } = options;
  const skip = (page - 1) * limit;

  const query = { project: projectObjectId, projectType };

  return this.find(query)
    .populate("project")
    .sort({ [sortBy]: sortOrder })
    .skip(skip)
    .limit(limit);
};

measurementBookSchema.statics.countByProject = function (
  projectObjectId,
  projectType
) {
  return this.countDocuments({ project: projectObjectId, projectType });
};

// Static method to create multiple MBs
measurementBookSchema.statics.createMultiple = async function (
  mbDataArray,
  session = null
) {
  const options = session ? { session } : {};
  return await this.insertMany(mbDataArray, options);
};

// Instance methods
measurementBookSchema.methods.approve = function (approverInfo) {
  this.approvedBy = {
    userId: approverInfo.userId,
    name: approverInfo.name,
    role: approverInfo.role,
    approvedAt: new Date(),
  };
  return this.save();
};

measurementBookSchema.methods.reject = function (rejectorInfo, reason) {
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
