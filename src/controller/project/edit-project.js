import Project from "../../models/project.model.js";
import { funds } from "../../utils/constants.js";

const editProject = async (req, res) => {
  try {
    const { id } = req.params;

    // Find existing project
    const existingProject = await Project.findOne({ projectId: id });
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check if user has permission to edit
    if (req.user.designation !== "JE") {
      return res.status(403).json({
        success: false,
        message: "Only JE can edit projects",
      });
    }

    // Check ownership - JE can only edit their own projects
    if (existingProject.createdBy.userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: "You can only edit projects created by you",
      });
    }

    // Check if project is editable
    if (!existingProject.isProjectEditable) {
      return res.status(403).json({
        success: false,
        message: "This project is currently locked and cannot be edited",
        details: {
          currentStatus: existingProject.status,
          suggestion:
            "Please contact your supervisor if you believe this is an error",
        },
      });
    }

    // Check if project can be edited based on status
    const nonEditableStatuses = ["Completed"];
    if (nonEditableStatuses.includes(existingProject.status)) {
      return res.status(400).json({
        success: false,
        message: `Projects with status '${existingProject.status}' cannot be edited`,
      });
    }

    // Parse FormData - complex objects come as JSON strings
    let updateData = { ...req.body };

    // Parse JSON strings from FormData
    try {
      if (typeof updateData.geoLocation === "string") {
        updateData.geoLocation = JSON.parse(updateData.geoLocation);
      }
      if (typeof updateData.subProjects === "string") {
        updateData.subProjects = JSON.parse(updateData.subProjects);
      }
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      return res.status(400).json({
        success: false,
        message: "Invalid data format in request",
      });
    }

    // Convert string boolean to actual boolean (FormData sends everything as strings)
    if (typeof updateData.hasSubProjects === "string") {
      updateData.hasSubProjects = updateData.hasSubProjects === "true";
    }

    // Get uploaded files from Firebase middleware (if any new files)
    const uploadedFiles = req.firebaseFiles || [];

    // Validate fields that are being updated
    const fieldsToValidate = {};

    // Only validate fields that are being updated
    if (updateData.projectName !== undefined) {
      fieldsToValidate.projectName = "Project name is required";
      if (
        !updateData.projectName ||
        updateData.projectName.trim().length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Project name cannot be empty",
        });
      }
    }

    if (updateData.workOrderNumber !== undefined) {
      fieldsToValidate.workOrderNumber = "Work order number is required";
      if (
        !updateData.workOrderNumber ||
        updateData.workOrderNumber.trim().length === 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Work order number cannot be empty",
        });
      }

      // Check if work order number is unique (exclude current project)
      const existingWorkOrder = await Project.findOne({
        workOrderNumber: updateData.workOrderNumber.trim(),
        projectId: { $ne: id },
      });

      if (existingWorkOrder) {
        return res.status(409).json({
          success: false,
          message: "Work order number already exists",
        });
      }
    }

    // Validate dates if they are being updated
    if (updateData.projectStartDate || updateData.projectEndDate) {
      const startDate = updateData.projectStartDate
        ? new Date(updateData.projectStartDate)
        : existingProject.projectStartDate;
      const endDate = updateData.projectEndDate
        ? new Date(updateData.projectEndDate)
        : existingProject.projectEndDate;

      if (endDate <= startDate) {
        return res.status(400).json({
          success: false,
          message: "Project end date must be after start date",
        });
      }

      // Validate extension period if being updated
      if (updateData.extensionPeriodForCompletion) {
        const extensionDate = new Date(updateData.extensionPeriodForCompletion);
        if (extensionDate <= endDate) {
          return res.status(400).json({
            success: false,
            message: "Extension period must be after project end date",
          });
        }
      }
    }

    // Validate geoLocation if being updated
    if (updateData.geoLocation) {
      if (!updateData.geoLocation) {
        return res.status(400).json({
          success: false,
          message: "Location coordinates are required",
        });
      }

      const latitude = Number(updateData.geoLocation.latitude);
      const longitude = Number(updateData.geoLocation.longitude);

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({
          success: false,
          message: "Valid location coordinates are required",
        });
      }

      // Update with converted numbers
      updateData.geoLocation = { latitude, longitude };
    }

    // Validate contractor phone number if being updated
    if (updateData.contractorPhoneNumber) {
      const phoneRegex = /^(\+91[\s-]?)?[6-9]\d{9}$/;
      const cleanPhone = updateData.contractorPhoneNumber.replace(/[\s-]/g, "");
      if (!phoneRegex.test(cleanPhone)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid Indian phone number",
        });
      }
    }

    // Validate fund and subFund if being updated
    if (updateData.fund || updateData.subFund) {
      const fundToValidate = updateData.fund || existingProject.fund;
      const subFundToValidate = updateData.subFund || existingProject.subFund;

      const mainFund = funds.find((f) => f.name === fundToValidate);
      if (!mainFund) {
        return res.status(400).json({
          success: false,
          message: "Invalid fund selected",
        });
      }

      const validSubFund = mainFund.subFunds.find(
        (sf) => sf.name === subFundToValidate
      );
      if (!validSubFund) {
        return res.status(400).json({
          success: false,
          message: `Invalid sub fund selected for ${fundToValidate}`,
        });
      }
    }

    // Process new uploaded files if any
    let processedUploadedFiles = [...existingProject.uploadedFiles]; // Keep existing files

    if (uploadedFiles && uploadedFiles.length > 0) {
      console.log(
        `Processing ${uploadedFiles.length} new files uploaded to Firebase`
      );

      const newFiles = uploadedFiles.map((file) => {
        const fileExtension = file.fileName.split(".").pop()?.toLowerCase();
        let mappedFileType = fileExtension;

        if (fileExtension === "jpeg") {
          mappedFileType = "jpg";
        } else if (fileExtension === "txt") {
          mappedFileType = "doc";
        }

        const allowedTypes = [
          "pdf",
          "jpg",
          "jpeg",
          "png",
          "doc",
          "docx",
          "xls",
          "xlsx",
        ];
        if (!allowedTypes.includes(mappedFileType)) {
          console.warn(
            `Unknown file type: ${fileExtension}, defaulting to 'doc'`
          );
          mappedFileType = "doc";
        }

        return {
          fileName: file.fileName,
          fileType: mappedFileType,
          fileSize: Number(file.fileSize),
          downloadURL: file.downloadURL,
          filePath: file.filePath,
          uploadedAt: file.uploadedAt || new Date(),
          uploadedBy: {
            userId: req.user.userId,
            name: req.user.fullName || req.user.username,
          },
        };
      });

      // Add new files to existing files
      processedUploadedFiles = [...processedUploadedFiles, ...newFiles];

      // Log uploaded files for debugging
      uploadedFiles.forEach((file, index) => {
        console.log(
          `New File ${index + 1}: ${file.originalName} -> ${file.fileName} (${(
            file.fileSize / 1024
          ).toFixed(2)}KB)`
        );
      });
    }

    // Process subProjects if being updated
    let processedSubProjects = existingProject.subProjects;
    if (updateData.subProjects !== undefined) {
      processedSubProjects = [];

      if (
        updateData.subProjects &&
        Array.isArray(updateData.subProjects) &&
        updateData.hasSubProjects !== false
      ) {
        for (const subProject of updateData.subProjects) {
          // Validate subProject fields
          if (
            !subProject.projectName ||
            !subProject.estimatedAmount ||
            !subProject.typeOfWork
          ) {
            return res.status(400).json({
              success: false,
              message: "Sub-project missing required fields",
            });
          }

          const subStartDate = new Date(subProject.projectStartDate);
          const subEndDate = new Date(subProject.projectEndDate);

          if (subEndDate <= subStartDate) {
            return res.status(400).json({
              success: false,
              message: "Sub-project end date must be after start date",
            });
          }

          processedSubProjects.push({
            projectName: subProject.projectName.trim(),
            estimatedAmount: Number(subProject.estimatedAmount),
            typeOfWork: subProject.typeOfWork.trim(),
            projectStartDate: subStartDate,
            projectEndDate: subEndDate,
            extensionPeriodForCompletion:
              subProject.extensionPeriodForCompletion
                ? new Date(subProject.extensionPeriodForCompletion)
                : undefined,
            parentProjectId: existingProject._id,
          });
        }
      }
    }

    // Prepare update object
    const updateObject = {};

    // Only update fields that are provided
    const fieldsToUpdate = [
      "dateOfIssueOfWorkOrder",
      "projectName",
      "description",
      "hasSubProjects",
      "fund",
      "subFund",
      "sanctioningDepartment",
      "budgetHead",
      "beneficiary",
      "workOrderNumber",
      "contractorName",
      "contractorAddress",
      "contractorPhoneNumber",
      "estimatedCost",
      "typeOfWork",
      "projectStartDate",
      "projectEndDate",
      "extensionPeriodForCompletion",
      "district",
      "block",
      "gramPanchayat",
    ];

    fieldsToUpdate.forEach((field) => {
      if (updateData[field] !== undefined) {
        if (
          field === "dateOfIssueOfWorkOrder" ||
          field === "projectStartDate" ||
          field === "projectEndDate"
        ) {
          updateObject[field] = new Date(updateData[field]);
        } else if (field === "extensionPeriodForCompletion") {
          updateObject[field] = updateData[field]
            ? new Date(updateData[field])
            : undefined;
        } else if (field === "estimatedCost") {
          updateObject[field] = Number(updateData[field]);
        } else if (field === "hasSubProjects") {
          updateObject[field] = Boolean(updateData[field]);
        } else if (typeof updateData[field] === "string") {
          updateObject[field] = updateData[field].trim();
        } else {
          updateObject[field] = updateData[field];
        }
      }
    });

    // Handle geoLocation
    if (updateData.geoLocation) {
      updateObject.geoLocation = {
        type: "Point",
        coordinates: [
          Number(updateData.geoLocation.longitude),
          Number(updateData.geoLocation.latitude),
        ],
      };
    }

    // Update files and subProjects
    updateObject.uploadedFiles = processedUploadedFiles;
    updateObject.subProjects = processedSubProjects;

    // Update lastModifiedBy
    updateObject.lastModifiedBy = {
      userId: req.user.userId,
      name: req.user.fullName || req.user.username,
      role: req.user.designation,
      modifiedAt: new Date(),
    };

    // HANDLE STATUS UPDATE TO "RESUBMITTED FOR APPROVAL"
    const currentStatus = existingProject.status;
    const newStatus = "Resubmitted for Approval";

    // Create status history entry
    const statusHistoryEntry = {
      previousStatus: currentStatus,
      newStatus: newStatus,
      changedBy: {
        userId: req.user.userId,
        name: req.user.fullName || req.user.username,
        role: req.user.designation,
      },
      remarks: "Project edited and resubmitted for approval",
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get("User-Agent") || "Unknown",
    };

    // Update status and add to status history
    updateObject.status = newStatus;
    updateObject.$push = {
      statusHistory: statusHistoryEntry,
    };

    // Create editable status history entry
    const editableStatusHistoryEntry = {
      previousStatus: existingProject.isProjectEditable || false,
      newStatus: false,
      changedBy: {
        userId: req.user.userId,
        name: req.user.fullName || req.user.username,
        role: req.user.designation,
      },
      reason:
        "Automatic: Project edited and resubmitted for approval, locking for review",
      changedAt: new Date(),
    };

    // Update isProjectEditable and add to history
    updateObject.isProjectEditable = false;

    // Add to editableStatusHistory array
    if (!updateObject.$push) {
      updateObject.$push = {};
    }
    updateObject.$push.editableStatusHistory = editableStatusHistoryEntry;

    // Update status workflow
    updateObject["statusWorkflow.submittedAt"] = new Date();
    // Clear previous workflow timestamps that are no longer relevant
    updateObject["statusWorkflow.approvedAt"] = undefined;
    updateObject["statusWorkflow.rejectedAt"] = undefined;
    updateObject["statusWorkflow.approvedBy"] = undefined;
    updateObject["statusWorkflow.rejectedBy"] = undefined;

    // Perform the update - Use filter object instead of just id
    const updatedProject = await Project.findOneAndUpdate(
      { projectId: id }, // Filter object using projectId field
      updateObject,
      {
        new: true,
        runValidators: false,
        context: "query", // This ensures custom validators run
      }
    );

    if (!updatedProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Log successful update
    console.log(
      `Project updated successfully: ${updatedProject.projectId} by ${req.user.username}. Status changed from '${currentStatus}' to '${newStatus}'`
    );

    // Prepare response with changes summary
    const changesSummary = {
      fieldsUpdated: Object.keys(updateObject).filter(
        (key) =>
          ![
            "lastModifiedBy",
            "uploadedFiles",
            "subProjects",
            "status",
            "statusHistory",
            "$push",
            "statusWorkflow",
          ].includes(key) && !key.startsWith("statusWorkflow.")
      ),
      filesAdded: uploadedFiles.length,
      totalFiles: processedUploadedFiles.length,
      subProjectsCount: processedSubProjects.length,
      statusChanged: {
        from: currentStatus,
        to: newStatus,
        reason: "Project edited and resubmitted",
      },
      updatedBy: {
        userId: req.user.userId,
        name: req.user.fullName || req.user.username,
        role: req.user.designation,
      },
    };

    res.status(200).json({
      success: true,
      message: "Project updated successfully and resubmitted for approval",
      data: {
        id: updatedProject._id,
        projectId: updatedProject.projectId,
        projectName: updatedProject.projectName,
        workOrderNumber: updatedProject.workOrderNumber,
        fund: updatedProject.fund,
        subFund: updatedProject.subFund,
        contractorName: updatedProject.contractorName,
        contractorPhoneNumber: updatedProject.contractorPhoneNumber,
        status: updatedProject.status,
        previousStatus: currentStatus,
        statusChangedAt: new Date(),
        filesUploaded: {
          totalCount: processedUploadedFiles.length,
          newFilesAdded: uploadedFiles.length,
          totalSize: processedUploadedFiles.reduce(
            (sum, file) => sum + file.fileSize,
            0
          ),
          types: processedUploadedFiles.reduce((acc, file) => {
            acc[file.fileType] = (acc[file.fileType] || 0) + 1;
            return acc;
          }, {}),
        },
        lastModifiedAt: updatedProject.lastModifiedBy.modifiedAt,
      },
      changes: changesSummary,
      metadata: {
        originalCreatedBy: updatedProject.createdBy,
        lastModifiedBy: updatedProject.lastModifiedBy,
        statusHistory: updatedProject.statusHistory.length,
        firebaseStorage: {
          bucket: process.env.FIREBASE_STORAGE_BUCKET,
          folder: "project-documents",
          newFilesUploaded: uploadedFiles.length,
        },
      },
    });
  } catch (error) {
    console.error("Error updating project:", error);

    // Handle validation errors with user-friendly messages
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors);
      const keyIssues = [];

      validationErrors.forEach((err) => {
        if (err.path === "projectName")
          keyIssues.push("Project name is invalid");
        else if (err.path === "contractorPhoneNumber")
          keyIssues.push("Phone number format is invalid");
        else if (err.path === "estimatedCost")
          keyIssues.push("Estimated cost must be a valid amount");
        else if (err.path === "projectEndDate")
          keyIssues.push("Project dates are invalid");
        else if (err.path === "geoLocation")
          keyIssues.push("Location coordinates are required");
        else if (err.path.includes("subProjects"))
          keyIssues.push("Sub-project data is incomplete");
        else if (err.path.includes("uploadedFiles"))
          keyIssues.push("File upload data is incomplete");
        else keyIssues.push(err.message);
      });

      return res.status(400).json({
        success: false,
        message:
          keyIssues.length > 3
            ? "Multiple fields need correction. Please review your input."
            : keyIssues.join(", "),
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      const friendlyField =
        field === "workOrderNumber"
          ? "Work order number"
          : field === "projectId"
          ? "Project ID"
          : field;

      return res.status(409).json({
        success: false,
        message: `${friendlyField} already exists`,
      });
    }

    // Handle Firebase storage errors
    if (error.message && error.message.includes("Firebase")) {
      return res.status(500).json({
        success: false,
        message: "Cloud storage error occurred during file processing",
        details: {
          error: error.message,
          filesAffected: req.firebaseFiles?.length || 0,
          suggestion:
            "Please try again or contact administrator if the problem persists",
        },
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update project. Please try again.",
      details: {
        newFilesUploaded: req.firebaseFiles?.length || 0,
        timestamp: new Date().toISOString(),
      },
      error:
        process.env.NODE_ENV === "development"
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    });
  }
};

export default editProject;
