import mongoose from "mongoose";

const measurementBookSchema = new mongoose.Schema(
  {
    // Project reference
    project: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Project reference is required"],
      index: true,
      refPath: "projectType",
    },

    projectType: {
      type: String,
      required: [true, "Project type is required"],
      enum: ["Project", "ArchiveProject"],
      index: true,
    },

    // Unique MB identifier
    mbId: {
      type: String,
      required: [true, "MB ID is required"],
      trim: true,
      uppercase: true,
    },

    // MB Details
    mbNo: {
      type: String,
      required: [true, "MB Number is required"],
      trim: true,
    },

    nameOfWork: {
      type: String,
      required: [true, "Name of Work is required"],
      trim: true,
      minlength: [5, "Name of Work must be at least 5 characters"],
      maxlength: [500, "Name of Work cannot exceed 500 characters"],
    },

    location: {
      type: String,
      required: [true, "Location is required"],
      trim: true,
      maxlength: [200, "Location cannot exceed 200 characters"],
    },

    contractor: {
      type: String,
      required: [true, "Contractor name is required"],
      trim: true,
      maxlength: [200, "Contractor name cannot exceed 200 characters"],
    },

    tenderAgreement: {
      type: String,
      trim: true,
      maxlength: [200, "Tender Agreement cannot exceed 200 characters"],
    },

    aaOrFsNo: {
      type: String,
      trim: true,
      maxlength: [100, "A.A. or F.S. No. cannot exceed 100 characters"],
    },

    aaOrFsDate: {
      type: Date,
    },

    slNoOfBill: {
      type: String,
      trim: true,
      maxlength: [50, "SL No. of Bill cannot exceed 50 characters"],
    },

    dateOfCommencement: {
      type: Date,
      required: [true, "Date of Commencement is required"],
    },

    dateOfCompletion: {
      type: Date,
      required: [true, "Date of Completion is required"],
    },

    dateOfMeasurement: {
      type: Date,
      required: [true, "Date of Measurement is required"],
    },

    // Measurements array - each measurement item with its own file
    measurements: [
      {
        id: {
          type: String,
          required: true,
        },
        description: {
          type: String,
          required: [true, "Item description is required"],
          trim: true,
          minlength: [5, "Item description must be at least 5 characters"],
          maxlength: [1000, "Item description cannot exceed 1000 characters"],
        },
        unit: {
          type: String,
          required: [true, "Unit is required"],
          trim: true,
          maxlength: [50, "Unit cannot exceed 50 characters"],
        },
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
      },
    ],

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
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
measurementBookSchema.index({ project: 1, projectType: 1, createdAt: -1 });
measurementBookSchema.index({ project: 1, projectType: 1 });
measurementBookSchema.index({ projectType: 1, createdAt: -1 });
measurementBookSchema.index({ "createdBy.userId": 1, projectType: 1 });
measurementBookSchema.index({ mbId: 1 }, { unique: true });
measurementBookSchema.index({ mbNo: 1 });

// Text index for search functionality
measurementBookSchema.index({
  nameOfWork: "text",
  location: "text",
  contractor: "text",
  "measurements.description": "text",
});

// Virtual for total measurements count
measurementBookSchema.virtual("totalMeasurements").get(function () {
  return this.measurements ? this.measurements.length : 0;
});

// Virtual for total file size
measurementBookSchema.virtual("totalFileSize").get(function () {
  if (!this.measurements || this.measurements.length === 0) return 0;

  return this.measurements.reduce((total, measurement) => {
    return total + (measurement.uploadedFile?.fileSize || 0);
  }, 0);
});

// Virtual for human-readable total file size
measurementBookSchema.virtual("humanReadableTotalFileSize").get(function () {
  const bytes = this.totalFileSize;
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

// Static method to generate unique MB ID
measurementBookSchema.statics.generateMBId = async function () {
  const prefix = "MB";
  let isUnique = false;
  let mbId;

  while (!isUnique) {
    // Generate random number between 100 and 999999
    const randomNum = Math.floor(Math.random() * 899900) + 100;
    mbId = `${prefix}_${randomNum}`;

    // Check if this ID already exists
    const existing = await this.findOne({ mbId });
    if (!existing) {
      isUnique = true;
    }
  }

  return mbId;
};

// Static methods
measurementBookSchema.statics.findByProject = function (
  projectObjectId,
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

// Instance method to add measurement
measurementBookSchema.methods.addMeasurement = function (measurementData) {
  this.measurements.push(measurementData);
  return this.save();
};

// Instance method to remove measurement
measurementBookSchema.methods.removeMeasurement = function (measurementId) {
  this.measurements = this.measurements.filter((m) => m.id !== measurementId);
  return this.save();
};

// Instance method to update measurement
measurementBookSchema.methods.updateMeasurement = function (
  measurementId,
  updateData
) {
  const measurement = this.measurements.find((m) => m.id === measurementId);
  if (measurement) {
    Object.assign(measurement, updateData);
  }
  return this.save();
};

const MeasurementBook = mongoose.model(
  "MeasurementBook",
  measurementBookSchema
);

export default MeasurementBook;
