// import mongoose from "mongoose";

// // Schema for individual progress updates (physical/work progress)
// const progressUpdateSchema = new mongoose.Schema(
//   {
//     previousProgress: {
//       type: Number,
//       min: [0, "Progress cannot be negative"],
//       max: [100, "Progress cannot exceed 100%"],
//       required: true,
//     },
//     newProgress: {
//       type: Number,
//       min: [0, "Progress cannot be negative"],
//       max: [100, "Progress cannot exceed 100%"],
//       required: true,
//     },
//     progressDifference: {
//       type: Number,
//       required: true,
//     },
//     remarks: {
//       type: String,
//       maxlength: [500, "Remarks cannot exceed 500 characters"],
//       trim: true,
//     },
//     supportingDocuments: [
//       {
//         fileName: {
//           type: String,
//           required: true,
//         },
//         originalName: {
//           type: String,
//           required: true,
//         },
//         downloadURL: {
//           type: String,
//           required: true,
//         },
//         filePath: {
//           type: String,
//           required: true, // Firebase storage path for deletion
//         },
//         fileSize: {
//           type: Number,
//           required: true,
//         },
//         mimeType: {
//           type: String,
//           required: true,
//         },
//         fileType: {
//           type: String,
//           enum: ["document", "image"],
//           required: true,
//         },
//         uploadedAt: {
//           type: Date,
//           default: Date.now,
//         },
//       },
//     ],
//     updatedBy: {
//       userId: {
//         type: mongoose.Schema.Types.ObjectId,
//         required: true,
//       },
//       userName: {
//         type: String,
//         required: true,
//       },
//       userDesignation: {
//         type: String,
//         required: true,
//       },
//     },
//     ipAddress: String,
//     userAgent: String,
//   },
//   {
//     timestamps: true,
//   }
// );

// // Schema for individual financial progress updates
// const financialProgressUpdateSchema = new mongoose.Schema(
//   {
//     previousFinancialProgress: {
//       type: Number,
//       min: [0, "Financial progress cannot be negative"],
//       max: [100, "Financial progress cannot exceed 100%"],
//       required: true,
//     },
//     newFinancialProgress: {
//       type: Number,
//       min: [0, "Financial progress cannot be negative"],
//       max: [100, "Financial progress cannot exceed 100%"],
//       required: true,
//     },
//     progressDifference: {
//       type: Number,
//       required: true,
//     },
//     previousBillAmount: {
//       type: Number,
//       min: [0, "Bill amount cannot be negative"],
//       required: true,
//     },
//     newBillAmount: {
//       type: Number,
//       min: [0, "Bill amount cannot be negative"],
//       required: true,
//     },
//     amountDifference: {
//       type: Number,
//       required: true,
//     },
//     remarks: {
//       type: String,
//       maxlength: [500, "Remarks cannot exceed 500 characters"],
//       trim: true,
//     },
//     billDetails: {
//       billNumber: {
//         type: String,
//         trim: true,
//       },
//       billDate: {
//         type: Date,
//       },
//       billDescription: {
//         type: String,
//         maxlength: [200, "Bill description cannot exceed 200 characters"],
//         trim: true,
//       },
//     },
//     supportingDocuments: [
//       {
//         fileName: {
//           type: String,
//           required: true,
//         },
//         originalName: {
//           type: String,
//           required: true,
//         },
//         downloadURL: {
//           type: String,
//           required: true,
//         },
//         filePath: {
//           type: String,
//           required: true, // Firebase storage path for deletion
//         },
//         fileSize: {
//           type: Number,
//           required: true,
//         },
//         mimeType: {
//           type: String,
//           required: true,
//         },
//         fileType: {
//           type: String,
//           enum: ["document", "image"],
//           required: true,
//         },
//         uploadedAt: {
//           type: Date,
//           default: Date.now,
//         },
//       },
//     ],
//     updatedBy: {
//       userId: {
//         type: mongoose.Schema.Types.ObjectId,
//         required: true,
//       },
//       userName: {
//         type: String,
//         required: true,
//       },
//       userDesignation: {
//         type: String,
//         required: true,
//       },
//     },
//     ipAddress: String,
//     userAgent: String,
//   },
//   {
//     timestamps: true,
//   }
// );

// const archiveProjectSchema = new mongoose.Schema(
//   {
//     projectId: {
//       type: String,
//       required: [true, "Project ID is required"],
//       unique: true,
//       index: true,
//     },
//     financialYear: {
//       type: String,
//       required: [true, "Financial year is required"],
//       match: [/^\d{4}-\d{4}$/, "Financial year must be in YYYY-YYYY format"],
//       index: true,
//     },
//     AANumber: {
//       type: String,
//       required: [true, "A.A no. is required"],
//       trim: true,
//       index: true,
//     },
//     AAAmount: {
//       type: Number,
//       required: [true, "A.A amount is required"],
//       min: [0, "A.A amount must be positive"],
//     },
//     AADated: {
//       type: Date,
//       required: [true, "A.A date is required"],
//     },
//     nameOfWork: {
//       type: String,
//       required: [true, "Name of work is required"],
//       minlength: [10, "Project name must be at least 10 characters"],
//       maxlength: [200, "Project name cannot exceed 200 characters"],
//       trim: true,
//       index: true,
//     },
//     nameOfContractor: {
//       type: String,
//       required: [true, "Name of contractor is required"],
//       minlength: [8, "Contractor name must be at least 8 characters"],
//       maxlength: [100, "Contractor name cannot exceed 100 characters"],
//       trim: true,
//       index: true,
//     },
//     workValue: {
//       type: Number,
//       required: [true, "Work value is required"],
//       min: [0, "Work value must be positive"],
//     },
//     FWONumberAndDate: {
//       type: String,
//       trim: true,
//     },
//     FWODate: {
//       type: Date,
//     },

//     // Physical/Work Progress
//     progress: {
//       type: Number,
//       min: [0, "Progress cannot be negative"],
//       max: [100, "Progress cannot exceed 100%"],
//       default: 0,
//     },

//     // Financial Progress
//     financialProgress: {
//       type: Number,
//       min: [0, "Financial progress cannot be negative"],
//       max: [100, "Financial progress cannot exceed 100%"],
//       default: 0,
//     },

//     billSubmittedAmount: {
//       type: Number,
//       min: [0, "Bill submitted amount cannot be negative"],
//       required: [true, "Bill submitted amount is required"],
//       default: 0,
//     },
//     location: {
//       type: String,
//       trim: true,
//       required: [true, "Location is required"],
//       minlength: [3, "Location must be at least 3 characters"],
//       maxlength: [100, "Location cannot exceed 100 characters"],
//       index: true,
//     },
//     billNumber: {
//       type: String,
//       required: [true, "Bill number is required"],
//       trim: true,
//     },
//     concernedEngineer: {
//       type: String,
//       required: [true, "Concerned engineer is required"],
//       trim: true,
//       index: true,
//     },
//     remarks: {
//       type: String,
//       maxlength: [500, "Remarks cannot exceed 500 characters"],
//       trim: true,
//     },

//     // Progress updates (physical/work progress)
//     progressUpdates: [progressUpdateSchema],

//     // Financial progress updates
//     financialProgressUpdates: [financialProgressUpdateSchema],

//     // Track last updates
//     lastProgressUpdate: {
//       type: Date,
//       default: null,
//     },
//     lastFinancialProgressUpdate: {
//       type: Date,
//       default: null,
//     },

//     // Track if updates are enabled
//     progressUpdatesEnabled: {
//       type: Boolean,
//       default: true,
//     },
//     financialProgressUpdatesEnabled: {
//       type: Boolean,
//       default: true,
//     },
//   },
//   {
//     timestamps: true,
//     toJSON: { virtuals: true },
//     toObject: { virtuals: true },
//   }
// );

// // Existing indexes
// archiveProjectSchema.index({ financialYear: 1, concernedEngineer: 1 });
// archiveProjectSchema.index({ financialYear: 1, nameOfContractor: 1 });
// archiveProjectSchema.index({ financialYear: 1, location: 1 });
// archiveProjectSchema.index({ concernedEngineer: 1, progress: 1 });
// archiveProjectSchema.index({ workValue: -1, financialYear: 1 });
// archiveProjectSchema.index({ FWODate: -1 });
// archiveProjectSchema.index({ AADated: -1 });
// archiveProjectSchema.index({ createdAt: -1 });

// // New indexes for progress updates
// archiveProjectSchema.index({ "progressUpdates.createdAt": -1 });
// archiveProjectSchema.index({ "financialProgressUpdates.createdAt": -1 });
// archiveProjectSchema.index({ lastProgressUpdate: -1 });
// archiveProjectSchema.index({ lastFinancialProgressUpdate: -1 });
// archiveProjectSchema.index({ financialProgress: 1 });
// archiveProjectSchema.index({ progress: 1, financialProgress: 1 });

// // Text Index for searching
// archiveProjectSchema.index({
//   nameOfWork: "text",
//   nameOfContractor: "text",
//   location: "text",
//   remarks: "text",
// });

// // Existing virtuals
// archiveProjectSchema.virtual("remainingWorkValue").get(function () {
//   if (this.billSubmittedAmount && this.workValue) {
//     return this.workValue - this.billSubmittedAmount;
//   }
//   return this.workValue;
// });

// archiveProjectSchema.virtual("progressStatus").get(function () {
//   if (!this.progress) return "Not Started";
//   if (this.progress < 25) return "Just Started";
//   if (this.progress < 50) return "In Progress";
//   if (this.progress < 75) return "Halfway Complete";
//   if (this.progress < 100) return "Near Completion";
//   return "Completed";
// });

// // New virtuals for financial progress
// archiveProjectSchema.virtual("financialProgressStatus").get(function () {
//   if (!this.financialProgress) return "Not Started";
//   if (this.financialProgress < 25) return "Just Started";
//   if (this.financialProgress < 50) return "In Progress";
//   if (this.financialProgress < 75) return "Halfway Complete";
//   if (this.financialProgress < 100) return "Near Completion";
//   return "Completed";
// });

// archiveProjectSchema.virtual("remainingBillAmount").get(function () {
//   if (this.workValue && this.billSubmittedAmount) {
//     return this.workValue - this.billSubmittedAmount;
//   }
//   return this.workValue;
// });

// archiveProjectSchema.virtual("progressSummary").get(function () {
//   return {
//     physical: {
//       percentage: this.progress,
//       status: this.progressStatus,
//       lastUpdate: this.lastProgressUpdate,
//     },
//     financial: {
//       percentage: this.financialProgress,
//       status: this.financialProgressStatus,
//       lastUpdate: this.lastFinancialProgressUpdate,
//       amountSubmitted: this.billSubmittedAmount,
//       amountRemaining: this.remainingBillAmount,
//     },
//   };
// });

// // Progress update virtuals
// archiveProjectSchema.virtual("totalProgressUpdates").get(function () {
//   return this.progressUpdates ? this.progressUpdates.length : 0;
// });

// archiveProjectSchema.virtual("totalFinancialProgressUpdates").get(function () {
//   return this.financialProgressUpdates
//     ? this.financialProgressUpdates.length
//     : 0;
// });

// archiveProjectSchema.virtual("latestProgressUpdate").get(function () {
//   if (this.progressUpdates && this.progressUpdates.length > 0) {
//     return this.progressUpdates[this.progressUpdates.length - 1];
//   }
//   return null;
// });

// archiveProjectSchema.virtual("latestFinancialProgressUpdate").get(function () {
//   if (
//     this.financialProgressUpdates &&
//     this.financialProgressUpdates.length > 0
//   ) {
//     return this.financialProgressUpdates[
//       this.financialProgressUpdates.length - 1
//     ];
//   }
//   return null;
// });

// // Pre-save middleware
// archiveProjectSchema.pre("save", function (next) {
//   if (
//     this.billSubmittedAmount &&
//     this.workValue &&
//     this.billSubmittedAmount > this.workValue
//   ) {
//     next(new Error("Bill submitted amount cannot exceed work value"));
//   }

//   if (this.AADated > new Date()) {
//     next(new Error("A.A date cannot be in the future"));
//   }

//   // Auto-calculate financial progress based on bill amount
//   if (this.workValue > 0) {
//     this.financialProgress = Math.round(
//       (this.billSubmittedAmount / this.workValue) * 100
//     );
//   }

//   next();
// });

// // Static methods
// archiveProjectSchema.statics.findByFinancialYear = function (year) {
//   return this.find({ financialYear: year });
// };

// archiveProjectSchema.statics.findByEngineer = function (
//   engineerName,
//   page = 1,
//   limit = 10
// ) {
//   const skip = (page - 1) * limit;
//   return this.find({ concernedEngineer: engineerName })
//     .sort({ createdAt: -1 })
//     .skip(skip)
//     .limit(limit);
// };

// // Progress update statistics
// archiveProjectSchema.statics.getProgressUpdateStats = function (filter = {}) {
//   return this.aggregate([
//     { $match: filter },
//     { $unwind: "$progressUpdates" },
//     {
//       $group: {
//         _id: null,
//         totalUpdates: { $sum: 1 },
//         avgProgressIncrease: { $avg: "$progressUpdates.progressDifference" },
//         maxProgressIncrease: { $max: "$progressUpdates.progressDifference" },
//         minProgressIncrease: { $min: "$progressUpdates.progressDifference" },
//         totalFilesUploaded: {
//           $sum: { $size: "$progressUpdates.supportingDocuments" },
//         },
//       },
//     },
//   ]);
// };

// // Financial progress update statistics
// archiveProjectSchema.statics.getFinancialProgressUpdateStats = function (
//   filter = {}
// ) {
//   return this.aggregate([
//     { $match: filter },
//     { $unwind: "$financialProgressUpdates" },
//     {
//       $group: {
//         _id: null,
//         totalUpdates: { $sum: 1 },
//         avgProgressIncrease: {
//           $avg: "$financialProgressUpdates.progressDifference",
//         },
//         avgAmountIncrease: {
//           $avg: "$financialProgressUpdates.amountDifference",
//         },
//         totalAmountSubmitted: {
//           $sum: "$financialProgressUpdates.amountDifference",
//         },
//         maxProgressIncrease: {
//           $max: "$financialProgressUpdates.progressDifference",
//         },
//         minProgressIncrease: {
//           $min: "$financialProgressUpdates.progressDifference",
//         },
//         totalFilesUploaded: {
//           $sum: { $size: "$financialProgressUpdates.supportingDocuments" },
//         },
//       },
//     },
//   ]);
// };

// // Instance methods
// archiveProjectSchema.methods.calculateFinancialProgress = function () {
//   if (!this.billSubmittedAmount || !this.workValue) return 0;
//   return Math.round((this.billSubmittedAmount / this.workValue) * 100);
// };

// // Add progress update method
// archiveProjectSchema.methods.addProgressUpdate = function (
//   updateData,
//   userInfo
// ) {
//   const previousProgress = this.progress;
//   const newProgress = updateData.newProgress;
//   const progressDifference = newProgress - previousProgress;

//   const progressUpdate = {
//     previousProgress,
//     newProgress,
//     progressDifference,
//     remarks: updateData.remarks,
//     supportingDocuments: updateData.supportingDocuments || [],
//     updatedBy: {
//       userId: userInfo.userId,
//       userName: userInfo.userName,
//       userDesignation: userInfo.userDesignation,
//     },
//     ipAddress: updateData.ipAddress,
//     userAgent: updateData.userAgent,
//   };

//   this.progressUpdates.push(progressUpdate);
//   this.progress = newProgress;
//   this.lastProgressUpdate = new Date();

//   return this.save();
// };

// // Add financial progress update method
// archiveProjectSchema.methods.addFinancialProgressUpdate = function (
//   updateData,
//   userInfo
// ) {
//   const previousFinancialProgress = this.financialProgress;
//   const previousBillAmount = this.billSubmittedAmount;

//   const newBillAmount = updateData.newBillAmount;
//   const newFinancialProgress =
//     this.workValue > 0 ? Math.round((newBillAmount / this.workValue) * 100) : 0;

//   const progressDifference = newFinancialProgress - previousFinancialProgress;
//   const amountDifference = newBillAmount - previousBillAmount;

//   const financialProgressUpdate = {
//     previousFinancialProgress,
//     newFinancialProgress,
//     progressDifference,
//     previousBillAmount,
//     newBillAmount,
//     amountDifference,
//     remarks: updateData.remarks,
//     billDetails: updateData.billDetails || {},
//     supportingDocuments: updateData.supportingDocuments || [],
//     updatedBy: {
//       userId: userInfo.userId,
//       userName: userInfo.userName,
//       userDesignation: userInfo.userDesignation,
//     },
//     ipAddress: updateData.ipAddress,
//     userAgent: updateData.userAgent,
//   };

//   this.financialProgressUpdates.push(financialProgressUpdate);
//   this.billSubmittedAmount = newBillAmount;
//   this.financialProgress = newFinancialProgress;
//   this.lastFinancialProgressUpdate = new Date();

//   // Update bill number if provided
//   if (updateData.billDetails && updateData.billDetails.billNumber) {
//     this.billNumber = updateData.billDetails.billNumber;
//   }

//   return this.save();
// };

// // Get progress update history
// archiveProjectSchema.methods.getProgressUpdateHistory = function (
//   page = 1,
//   limit = 10
// ) {
//   const skip = (page - 1) * limit;
//   const updates = this.progressUpdates
//     .sort((a, b) => b.createdAt - a.createdAt)
//     .slice(skip, skip + limit);

//   return {
//     updates,
//     totalUpdates: this.progressUpdates.length,
//     currentPage: page,
//     totalPages: Math.ceil(this.progressUpdates.length / limit),
//     hasNextPage: page < Math.ceil(this.progressUpdates.length / limit),
//     hasPrevPage: page > 1,
//   };
// };

// // Get financial progress update history
// archiveProjectSchema.methods.getFinancialProgressUpdateHistory = function (
//   page = 1,
//   limit = 10
// ) {
//   const skip = (page - 1) * limit;
//   const updates = this.financialProgressUpdates
//     .sort((a, b) => b.createdAt - a.createdAt)
//     .slice(skip, skip + limit);

//   return {
//     updates,
//     totalUpdates: this.financialProgressUpdates.length,
//     currentPage: page,
//     totalPages: Math.ceil(this.financialProgressUpdates.length / limit),
//     hasNextPage: page < Math.ceil(this.financialProgressUpdates.length / limit),
//     hasPrevPage: page > 1,
//   };
// };

// const ArchiveProject = mongoose.model("ArchiveProject", archiveProjectSchema);

// export default ArchiveProject;

import mongoose from "mongoose";

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

    // Physical/Work Progress
    progress: {
      type: Number,
      min: [0, "Progress cannot be negative"],
      max: [100, "Progress cannot exceed 100%"],
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
archiveProjectSchema.index({ "financialProgressUpdates.createdAt": -1 });
archiveProjectSchema.index({ lastProgressUpdate: -1 });
archiveProjectSchema.index({ lastFinancialProgressUpdate: -1 });
archiveProjectSchema.index({ financialProgress: 1 });
archiveProjectSchema.index({ progress: 1, financialProgress: 1 });

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

// New virtuals for financial progress
archiveProjectSchema.virtual("financialProgressStatus").get(function () {
  if (!this.financialProgress) return "Not Started";
  if (this.financialProgress < 25) return "Just Started";
  if (this.financialProgress < 50) return "In Progress";
  if (this.financialProgress < 75) return "Halfway Complete";
  if (this.financialProgress < 100) return "Near Completion";
  return "Completed";
});

archiveProjectSchema.virtual("remainingBillAmount").get(function () {
  if (this.workValue && this.billSubmittedAmount) {
    return this.workValue - this.billSubmittedAmount;
  }
  return this.workValue;
});

archiveProjectSchema.virtual("progressSummary").get(function () {
  return {
    physical: {
      percentage: this.progress,
      status: this.progressStatus,
      lastUpdate: this.lastProgressUpdate,
    },
    financial: {
      percentage: this.financialProgress,
      status: this.financialProgressStatus,
      lastUpdate: this.lastFinancialProgressUpdate,
      amountSubmitted: this.billSubmittedAmount,
      amountRemaining: this.remainingBillAmount,
    },
  };
});

// Progress update virtuals
archiveProjectSchema.virtual("totalProgressUpdates").get(function () {
  return this.progressUpdates ? this.progressUpdates.length : 0;
});

archiveProjectSchema.virtual("totalFinancialProgressUpdates").get(function () {
  return this.financialProgressUpdates
    ? this.financialProgressUpdates.length
    : 0;
});

archiveProjectSchema.virtual("latestProgressUpdate").get(function () {
  if (this.progressUpdates && this.progressUpdates.length > 0) {
    return this.progressUpdates[this.progressUpdates.length - 1];
  }
  return null;
});

archiveProjectSchema.virtual("latestFinancialProgressUpdate").get(function () {
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

  // Auto-calculate financial progress based on bill amount
  if (this.workValue > 0) {
    this.financialProgress = Math.round(
      (this.billSubmittedAmount / this.workValue) * 100
    );
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

// Progress update statistics
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

// Financial progress update statistics
archiveProjectSchema.statics.getFinancialProgressUpdateStats = function (
  filter = {}
) {
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

// Instance methods
archiveProjectSchema.methods.calculateFinancialProgress = function () {
  if (!this.billSubmittedAmount || !this.workValue) return 0;
  return Math.round((this.billSubmittedAmount / this.workValue) * 100);
};

// Add progress update method
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

// Add financial progress update method
archiveProjectSchema.methods.addFinancialProgressUpdate = function (
  updateData,
  userInfo
) {
  const previousFinancialProgress = this.financialProgress;
  const previousBillAmount = this.billSubmittedAmount;

  const newBillAmount = updateData.newBillAmount;
  const newFinancialProgress =
    this.workValue > 0 ? Math.round((newBillAmount / this.workValue) * 100) : 0;

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

  // Update bill number if provided
  if (updateData.billDetails && updateData.billDetails.billNumber) {
    this.billNumber = updateData.billDetails.billNumber;
  }

  return this.save();
};

// Get progress update history
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

// Get financial progress update history
archiveProjectSchema.methods.getFinancialProgressUpdateHistory = function (
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

const ArchiveProject = mongoose.model("ArchiveProject", archiveProjectSchema);

export default ArchiveProject;
