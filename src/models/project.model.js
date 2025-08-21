import mongoose from "mongoose";
import { projectStatus } from "../utils/constants.js";

const projectSchema = new mongoose.Schema(
  {
    dateOfIssueOfWorkOrder: {
      type: Date,
      required: [true, "Date of issue of work order is required"],
      trim: true,
    },
    projectName: {
      type: String,
      required: [true, "Project name is required"],
      min: [5, "Project name must be at least 5 characters"],
      max: [100, "Project name cannot exceed 100 characters"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    hasSubProjects: String,
    fund: String,
    function: String,
    budgetHead: String,
    scheme: String,
    subScheme: String,
    owningDepartment: String,
    executingDepartment: String,
    beneficiary: String,
    letterReference: String,
    estimatedCost: Number,
    typeOfWork: String,
    subTypeOfWork: String,
    natureOfWork: String,
    projectStartDate: String,
    projectEndDate: String,
    recommendedModeOfExecution: String,
    // locality: String,
    // ward: String,
    // ulb: String,
    district: String,
    block: String,
    gramPanchayat: String,
    subProjects: { type: Array, default: [] },
    uploadedFiles: { type: Array, default: [] },
    geoLocation: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
    id: { type: Number, unique: true },
    projectId: String,
    createdAt: Date,

    // New field for user details
    createdBy: {
      userId: { type: String, required: true },
      name: { type: String, required: true },
      role: { type: String, required: true },
    },

    // New field for project status
    status: {
      type: String,
      enum: projectStatus,
      default: "Submitted to AEE",
    },
  },
  { timestamps: true }
);

projectSchema.index({ geoLocation: "2dsphere" });

const Project = mongoose.model("Project", projectSchema);

export default Project;
