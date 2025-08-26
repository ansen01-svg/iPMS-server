import Project from "../../models/project.model.js";

const createProject = async (req, res) => {
  try {
    const {
      dateOfIssueOfWorkOrder,
      projectName,
      description,
      hasSubProjects,
      fund,
      sanctionAndDepartment,
      budgetHead,
      beneficiary,
      workOrderNumber,
      estimatedCost,
      typeOfWork,
      natureOfWork,
      projectStartDate,
      projectEndDate,
      extensionPeriodForCompletion,
      district,
      block,
      gramPanchayat,
      geoLocation,
      subProjects,
      uploadedFiles,
    } = req.body;

    // Validate required fields
    const requiredFields = {
      dateOfIssueOfWorkOrder: "Date of issue of work order is required",
      projectName: "Project name is required",
      fund: "Fund is required",
      sanctionAndDepartment: "Sanction & Department is required",
      workOrderNumber: "Work order number is required",
      estimatedCost: "Estimated cost is required",
      typeOfWork: "Type of work is required",
      natureOfWork: "Nature of work is required",
      projectStartDate: "Project start date is required",
      projectEndDate: "Project end date is required",
      district: "District is required",
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
        message:
          "Valid geoLocation with latitude & longitude coordinates is required",
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

    if (!req.user || req.user !== "JE") {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Create project
    const project = new Project({
      dateOfIssueOfWorkOrder: new Date(dateOfIssueOfWorkOrder),
      projectId,
      projectName: projectName.trim(),
      description: description?.trim(),
      hasSubProjects: Boolean(hasSubProjects),
      fund,
      sanctionAndDepartment,
      budgetHead: budgetHead?.trim(),
      executingDepartment: "APTDCL",
      beneficiary: beneficiary?.trim(),
      workOrderNumber: workOrderNumber.trim(),
      estimatedCost: Number(estimatedCost),
      typeOfWork: typeOfWork.trim(),
      natureOfWork: natureOfWork.trim(),
      projectStartDate: new Date(projectStartDate),
      projectEndDate: new Date(projectEndDate),
      extensionPeriodForCompletion: extensionPeriodForCompletion
        ? new Date(extensionPeriodForCompletion)
        : undefined,
      district,
      block: block?.trim(),
      gramPanchayat: gramPanchayat?.trim(),
      subProjects: subProjects || [],
      uploadedFiles: uploadedFiles || [],
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
    });

    const savedProject = await project.save();

    res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: {
        id: savedProject._id,
        projectName: savedProject.projectName,
        workOrderNumber: savedProject.workOrderNumber,
        status: savedProject.status,
        createdAt: savedProject.createdAt,
      },
    });
  } catch (error) {
    console.error("Error creating project:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: `${field} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export default createProject;
