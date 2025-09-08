import Project from "../../models/project.model.js";
import { funds } from "../../utils/constants.js";

const createProject = async (req, res) => {
  try {
    const {
      dateOfIssueOfWorkOrder,
      projectName,
      description,
      hasSubProjects,
      fund,
      subFund,
      sanctioningDepartment,
      budgetHead,
      beneficiary,
      workOrderNumber,
      contractorName,
      contractorAddress,
      contractorPhoneNumber,
      estimatedCost,
      typeOfWork,
      projectStartDate,
      projectEndDate,
      extensionPeriodForCompletion,
      district,
      block,
      gramPanchayat,
      geoLocation,
      subProjects,
      status,
    } = req.body;
    console.log(req.firebaseFiles);

    // Get uploaded files from Firebase middleware (already processed and uploaded)
    const uploadedFiles = req.firebaseFiles || [];

    console.log(uploadedFiles);
    console.log(`Creating project with ${uploadedFiles.length} uploaded files`);

    // Validate required fields
    const requiredFields = {
      dateOfIssueOfWorkOrder: "Date of issue of work order is required",
      projectName: "Project name is required",
      fund: "Fund is required",
      subFund: "Sub fund is required",
      sanctioningDepartment: "Sanctioning Department is required",
      workOrderNumber: "Work order number is required",
      contractorName: "Contractor name is required",
      contractorAddress: "Contractor address is required",
      contractorPhoneNumber: "Contractor phone number is required",
      estimatedCost: "Estimated cost is required",
      typeOfWork: "Type of work is required",
      projectStartDate: "Project start date is required",
      projectEndDate: "Project end date is required",
      district: "District is required",
      status: "Project status is required",
    };

    for (const [field, message] of Object.entries(requiredFields)) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          message: message,
        });
      }
    }

    const utcTimestamp = Date.now();
    const projectId = `${typeOfWork}_${utcTimestamp}`;

    // Validate geoLocation
    if (
      !geoLocation ||
      typeof geoLocation.latitude !== "number" ||
      typeof geoLocation.longitude !== "number"
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid location coordinates are required",
      });
    }

    // Validate date logic
    const startDate = new Date(projectStartDate);
    const endDate = new Date(projectEndDate);

    if (endDate <= startDate) {
      return res.status(400).json({
        success: false,
        message: "Project end date must be after start date",
      });
    }

    if (extensionPeriodForCompletion) {
      const extensionDate = new Date(extensionPeriodForCompletion);
      if (extensionDate <= endDate) {
        return res.status(400).json({
          success: false,
          message: "Extension period must be after project end date",
        });
      }
    }

    // Validate contractor phone number format
    const phoneRegex = /^(\+91[\s-]?)?[6-9]\d{9}$/;
    const cleanPhone = contractorPhoneNumber.replace(/[\s-]/g, "");
    if (!phoneRegex.test(cleanPhone)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid Indian phone number",
      });
    }

    // Validate sub fund belongs to main fund
    const mainFund = funds.find((f) => f.name === fund);
    if (!mainFund) {
      return res.status(400).json({
        success: false,
        message: "Invalid fund selected",
      });
    }

    const validSubFund = mainFund.subFunds.find((sf) => sf.name === subFund);
    if (!validSubFund) {
      return res.status(400).json({
        success: false,
        message: `Invalid sub fund selected for ${fund}`,
      });
    }

    if (!req.user || req.user.designation !== "JE") {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Process uploaded files from Firebase middleware
    let processedUploadedFiles = [];
    if (uploadedFiles && uploadedFiles.length > 0) {
      console.log(
        `Processing ${uploadedFiles.length} files uploaded to Firebase`
      );

      processedUploadedFiles = uploadedFiles.map((file) => ({
        fileName: file.fileName,
        fileType:
          file.fileType ||
          file.fileName.split(".").pop()?.toLowerCase() ||
          "unknown",
        fileSize: Number(file.fileSize),
        downloadURL: file.downloadURL,
        filePath: file.filePath,
        uploadedAt: file.uploadedAt || new Date(),
        uploadedBy: {
          userId: req.user.userId,
          name: req.user.fullName || req.user.username,
        },
      }));

      // Log uploaded files for debugging
      uploadedFiles.forEach((file, index) => {
        console.log(
          `File ${index + 1}: ${file.originalName} -> ${file.fileName} (${(
            file.fileSize / 1024
          ).toFixed(2)}KB)`
        );
      });
    }

    // Create a temporary project to get the ID for subProjects
    const tempProject = new Project({
      dateOfIssueOfWorkOrder: new Date(dateOfIssueOfWorkOrder),
      projectId,
      projectName: projectName.trim(),
      description: description?.trim(),
      hasSubProjects: Boolean(hasSubProjects),
      fund,
      subFund,
      sanctioningDepartment,
      budgetHead: budgetHead?.trim(),
      executingDepartment: "APTDCL",
      beneficiary: beneficiary?.trim(),
      workOrderNumber: workOrderNumber.trim(),
      contractorName: contractorName.trim(),
      contractorAddress: contractorAddress.trim(),
      contractorPhoneNumber: contractorPhoneNumber.trim(),
      estimatedCost: Number(estimatedCost),
      typeOfWork: typeOfWork.trim(),
      projectStartDate: new Date(projectStartDate),
      projectEndDate: new Date(projectEndDate),
      extensionPeriodForCompletion: extensionPeriodForCompletion
        ? new Date(extensionPeriodForCompletion)
        : undefined,
      district,
      block: block?.trim(),
      gramPanchayat: gramPanchayat?.trim(),
      subProjects: [], // Will be set after processing
      uploadedFiles: processedUploadedFiles,
      geoLocation: {
        type: "Point",
        coordinates: [
          Number(geoLocation.longitude),
          Number(geoLocation.latitude),
        ],
      },
      createdBy: {
        userId: req.user.userId,
        name: req.user.fullName || req.user.username,
        role: req.user.designation,
      },
      status,
    });

    // Process subProjects with parentProjectId
    let processedSubProjects = [];
    if (subProjects && Array.isArray(subProjects) && hasSubProjects) {
      for (const subProject of subProjects) {
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
          extensionPeriodForCompletion: subProject.extensionPeriodForCompletion
            ? new Date(subProject.extensionPeriodForCompletion)
            : undefined,
          parentProjectId: tempProject._id,
        });
      }
    }

    // Set the processed subProjects
    tempProject.subProjects = processedSubProjects;

    // Save the project
    const savedProject = await tempProject.save();

    // Log successful creation
    console.log(
      `Project created successfully: ${savedProject.projectId} with ${processedUploadedFiles.length} files`
    );

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: {
        id: savedProject._id,
        projectId: savedProject.projectId,
        projectName: savedProject.projectName,
        workOrderNumber: savedProject.workOrderNumber,
        fund: savedProject.fund,
        subFund: savedProject.subFund,
        contractorName: savedProject.contractorName,
        contractorPhoneNumber: savedProject.contractorPhoneNumber,
        status: savedProject.status,
        filesUploaded: {
          count: processedUploadedFiles.length,
          totalSize: processedUploadedFiles.reduce(
            (sum, file) => sum + file.fileSize,
            0
          ),
          types: processedUploadedFiles.reduce((acc, file) => {
            acc[file.fileType] = (acc[file.fileType] || 0) + 1;
            return acc;
          }, {}),
        },
        createdAt: savedProject.createdAt,
      },
      metadata: {
        firebaseStorage: {
          bucket: process.env.FIREBASE_STORAGE_BUCKET,
          folder: "project-documents",
          filesUploaded: processedUploadedFiles.length,
        },
      },
    });
  } catch (error) {
    console.error("Error creating project:", error);

    // The Firebase middleware will handle cleanup of uploaded files if an error occurs
    // due to the cleanupFirebaseFiles middleware

    // Handle validation errors with user-friendly messages
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors);
      let userFriendlyMessage = "Please check the following:";

      // Extract key validation issues
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
      message: "Failed to create project. Please try again.",
      details: {
        filesUploaded: req.firebaseFiles?.length || 0,
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

export default createProject;
