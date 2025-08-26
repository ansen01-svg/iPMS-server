import mongoose from "mongoose";
import {
  districts,
  funds,
  natureOfWork,
  projectStatus,
  sanctionAndDepartment,
  typeOfWork,
} from "../utils/constants.js";

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
      enum: ["pdf", "jpg", "jpeg", "png"],
      lowercase: true,
    },
    fileSize: {
      type: Number,
      required: [true, "File size is required"],
      min: [1, "File size must be greater than 0"],
      max: [50 * 1024 * 1024, "File size cannot exceed 50MB"], // 50MB in bytes
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
      // match: [/^[A-Z0-9\-\/]+$/i, "Work order number format is invalid"],
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

    // Progress
    progressPercentage: {
      type: Number,
      min: [0, "Progress percentage cannot be less than 0"],
      max: [100, "Progress percentage cannot exceed 100"],
      default: 0,
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

// Indexes for better performance
projectSchema.index({ createdBy: 1, status: 1 });
projectSchema.index({ district: 1, status: 1 });
projectSchema.index({ projectStartDate: 1, projectEndDate: 1 });
projectSchema.index({ estimatedCost: 1, fund: 1 });

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
  return this.subProjects.reduce(
    (total, sub) => total + (sub.estimatedAmount || 0),
    0
  );
});

// Pre-save middleware to update lastModifiedBy
projectSchema.pre("save", function (next) {
  if (this.isModified() && !this.isNew) {
    this.lastModifiedBy.modifiedAt = new Date();
  }
  next();
});

const Project = mongoose.model("Project", projectSchema);

export default Project;
