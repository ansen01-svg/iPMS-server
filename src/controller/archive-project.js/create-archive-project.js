import ArchiveProject from "../../models/archive-project.model.js";

const createArchiveProject = async (req, res) => {
  try {
    const {
      financialYear,
      AANumber,
      AAAmount,
      AADated,
      nameOfWork,
      nameOfContractor,
      workValue,
      FWONumberAndDate,
      FWODate,
      progress = 0,
      billSubmittedAmount = 0,
      location,
      billNumber,
      concernedEngineer,
      remarks,
    } = req.body;

    const user = req.user;
    if (!user || user.designation !== "JE") {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    const utcTimestamp = Date.now();
    const projectId = `${AANumber.slice(0, 5).replace(
      /\//g,
      "-"
    )}_${utcTimestamp}`;

    // Additional business logic validation
    if (billSubmittedAmount > workValue) {
      return res.status(400).json({
        success: false,
        message: "Bill submitted amount cannot exceed work value",
        details: {
          workValue,
          billSubmittedAmount,
          difference: workValue - billSubmittedAmount,
        },
      });
    }

    if (new Date(AADated) > new Date()) {
      return res.status(400).json({
        success: false,
        message: "Administrative Approval date cannot be in the future",
      });
    }

    if (new Date(FWODate) > new Date()) {
      return res.status(400).json({
        success: false,
        message: "FWO date cannot be in the future",
      });
    }

    // Check if AA Number already exists for the same financial year
    const existingAA = await ArchiveProject.findOne({
      AANumber,
      financialYear,
    });
    if (existingAA) {
      return res.status(409).json({
        success: false,
        message:
          "Administrative Approval number already exists for this financial year",
        conflictingData: {
          AANumber,
          financialYear,
          existingProjectId: existingAA._id,
        },
      });
    }

    const archiveProject = new ArchiveProject({
      projectId,
      financialYear,
      AANumber,
      AAAmount,
      AADated,
      nameOfWork,
      nameOfContractor,
      workValue,
      FWONumberAndDate,
      FWODate,
      progress,
      billSubmittedAmount,
      location,
      billNumber,
      concernedEngineer,
      remarks,
    });

    const savedProject = await archiveProject.save();

    // Calculate additional information for response
    const responseData = {
      ...savedProject.toJSON(),
      calculatedProgress: savedProject.calculateFinancialProgress(),
      progressStatus: savedProject.progressStatus,
      remainingWorkValue: savedProject.remainingWorkValue,
    };

    console.log(
      `Archive project created successfully: ${savedProject._id} by user: ${
        req.user?.id || "Unknown"
      }`
    );

    res.status(201).json({
      success: true,
      message: "Archive project created successfully",
      data: responseData,
      metadata: {
        createdAt: savedProject.createdAt,
        projectId: savedProject._id,
        financialYear: savedProject.financialYear,
      },
    });
  } catch (error) {
    console.error("Error creating archive project:", error);

    // Handle specific mongoose errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
        value: err.value,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation error occurred",
        errors: validationErrors,
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyValue)[0];
      const duplicateValue = error.keyValue[duplicateField];

      return res.status(409).json({
        success: false,
        message: `Duplicate value detected`,
        details: {
          field: duplicateField,
          value: duplicateValue,
          message: `${duplicateField} '${duplicateValue}' already exists`,
        },
      });
    }

    // Handle cast errors (invalid ObjectId, etc.)
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid data format",
        details: {
          field: error.path,
          value: error.value,
          expectedType: error.kind,
        },
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while creating archive project",
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

export default createArchiveProject;
