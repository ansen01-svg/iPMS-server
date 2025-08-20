import mongoose from "mongoose";

const projectStatus = [
  "Draft",
  "Submitted to AEE",
  "Rejected by AEE",
  "Submitted to CE",
  "Rejected by CE",
  "Submitted to MD",
  "Rejected by MD",
  "Submitted to Executing Department",
  "Rejected by Executing Department",
  "Approved",
  "Ongoing",
  "Pending",
  "Completed",
];

const projectSchema = new mongoose.Schema(
  {
    dateOfProposal: String,
    projectName: String,
    description: String,
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
