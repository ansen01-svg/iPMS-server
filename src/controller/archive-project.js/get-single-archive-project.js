import mongoose from "mongoose";
import ArchiveProject from "../../models/archive-project.model.js";

export const getArchiveProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
        details: {
          providedId: id,
          expectedFormat: "MongoDB ObjectId (24 character hex string)",
        },
      });
    }

    // Find the project by ID
    const project = await ArchiveProject.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Archive project not found",
        details: {
          searchedId: id,
          suggestion: "Please verify the project ID and try again",
        },
      });
    }

    // Calculate virtual fields
    const projectData = project.toJSON();

    // Calculate remaining work value
    const remainingWorkValue = project.remainingWorkValue;

    // Get progress status
    const progressStatus = project.progressStatus;

    // Calculate financial progress
    const financialProgress = project.calculateFinancialProgress();

    // Add calculated fields to response
    const enrichedProject = {
      ...projectData,
      remainingWorkValue,
      progressStatus,
      financialProgress,
    };

    // Calculate additional project metrics
    const projectMetrics = {
      daysFromAAToFWO:
        project.AADated && project.FWODate
          ? Math.ceil(
              (new Date(project.FWODate) - new Date(project.AADated)) /
                (1000 * 60 * 60 * 24)
            )
          : null,
      daysFromFWOToNow: project.FWODate
        ? Math.ceil(
            (new Date() - new Date(project.FWODate)) / (1000 * 60 * 60 * 24)
          )
        : null,
      billSubmissionRate:
        project.workValue > 0
          ? Math.round(
              (project.billSubmittedAmount / project.workValue) * 100 * 100
            ) / 100
          : 0,
      isOverdue:
        project.progress < 100 && project.FWODate
          ? new Date() - new Date(project.FWODate) > 365 * 24 * 60 * 60 * 1000 // More than 1 year
          : false,
      projectAge: project.createdAt
        ? Math.ceil(
            (new Date() - new Date(project.createdAt)) / (1000 * 60 * 60 * 24)
          )
        : 0,
    };

    // Find related projects (same contractor, same engineer, same location)
    const relatedProjectsPromises = [
      // Projects by same contractor
      ArchiveProject.find({
        nameOfContractor: project.nameOfContractor,
        _id: { $ne: project._id },
      })
        .select("_id nameOfWork progress workValue financialYear")
        .limit(5)
        .sort({ createdAt: -1 }),

      // Projects by same engineer
      ArchiveProject.find({
        concernedEngineer: project.concernedEngineer,
        _id: { $ne: project._id },
      })
        .select("_id nameOfWork progress workValue financialYear")
        .limit(5)
        .sort({ createdAt: -1 }),

      // Projects in same location
      ArchiveProject.find({
        location: project.location,
        _id: { $ne: project._id },
      })
        .select("_id nameOfWork progress workValue financialYear")
        .limit(5)
        .sort({ createdAt: -1 }),
    ];

    const [projectsByContractor, projectsByEngineer, projectsByLocation] =
      await Promise.all(relatedProjectsPromises);

    // Compile response
    res.status(200).json({
      success: true,
      message: "Archive project retrieved successfully",
      data: {
        project: enrichedProject,
        metrics: projectMetrics,
        relatedProjects: {
          byContractor: projectsByContractor,
          byEngineer: projectsByEngineer,
          byLocation: projectsByLocation,
        },
      },
      metadata: {
        retrievedAt: new Date().toISOString(),
        projectId: project._id,
        financialYear: project.financialYear,
        lastUpdated: project.updatedAt,
      },
    });
  } catch (error) {
    console.error("Error retrieving archive project by ID:", error);

    // Handle specific mongoose errors
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
        details: {
          providedId: req.params.id,
          error: error.message,
          expectedFormat: "MongoDB ObjectId (24 character hex string)",
        },
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving archive project",
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

/**
 * Get archive project history/timeline
 * GET /api/archive-projects/:id/timeline
 */
export const getArchiveProjectTimeline = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    const project = await ArchiveProject.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Archive project not found",
      });
    }

    // Create timeline events
    const timeline = [];

    // Project creation
    if (project.createdAt) {
      timeline.push({
        date: project.createdAt,
        event: "Project Created",
        description: "Archive project record was created in the system",
        type: "creation",
      });
    }

    // Administrative Approval
    if (project.AADated) {
      timeline.push({
        date: project.AADated,
        event: "Administrative Approval",
        description: `AA Number: ${
          project.AANumber
        } for amount ₹${project.AAAmount.toLocaleString()}`,
        type: "approval",
        details: {
          AANumber: project.AANumber,
          amount: project.AAAmount,
        },
      });
    }

    // FWO Date
    if (project.FWODate) {
      timeline.push({
        date: project.FWODate,
        event: "FWO Issued",
        description: `${
          project.FWONumberAndDate
        } for work value ₹${project.workValue.toLocaleString()}`,
        type: "order",
        details: {
          FWONumber: project.FWONumberAndDate,
          workValue: project.workValue,
        },
      });
    }

    // Progress milestones (estimated based on current progress)
    if (project.progress > 0) {
      const milestones = [25, 50, 75, 100];
      const startDate = project.FWODate || project.AADated || project.createdAt;
      const currentDate = new Date();

      milestones.forEach((milestone) => {
        if (project.progress >= milestone) {
          // Estimate milestone date based on linear progress assumption
          const progressRatio = milestone / 100;
          const estimatedDate = new Date(
            startDate.getTime() +
              (currentDate.getTime() - startDate.getTime()) * progressRatio
          );

          timeline.push({
            date: estimatedDate,
            event: `${milestone}% Progress Milestone`,
            description: `Project reached ${milestone}% completion`,
            type: "progress",
            estimated: milestone < project.progress,
            details: {
              milestone,
              progressPercentage: milestone,
            },
          });
        }
      });
    }

    // Bill submission (if applicable)
    if (project.billSubmittedAmount > 0) {
      timeline.push({
        date: project.updatedAt, // Assuming last update was bill submission
        event: "Bill Submitted",
        description: `Bill Number: ${
          project.billNumber
        } for amount ₹${project.billSubmittedAmount.toLocaleString()}`,
        type: "billing",
        details: {
          billNumber: project.billNumber,
          amount: project.billSubmittedAmount,
        },
      });
    }

    // Sort timeline by date
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate project duration and phases
    const duration = {
      totalDays: project.createdAt
        ? Math.ceil(
            (new Date() - new Date(project.createdAt)) / (1000 * 60 * 60 * 24)
          )
        : 0,
      phases: {
        approvalToFWO:
          project.AADated && project.FWODate
            ? Math.ceil(
                (new Date(project.FWODate) - new Date(project.AADated)) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
        fwoToNow: project.FWODate
          ? Math.ceil(
              (new Date() - new Date(project.FWODate)) / (1000 * 60 * 60 * 24)
            )
          : null,
      },
    };

    res.status(200).json({
      success: true,
      message: "Archive project timeline retrieved successfully",
      data: {
        projectId: project._id,
        projectName: project.nameOfWork,
        timeline,
        duration,
        currentStatus: {
          progress: project.progress,
          progressStatus: project.progressStatus,
          remainingWork: project.remainingWorkValue,
        },
      },
    });
  } catch (error) {
    console.error("Error retrieving project timeline:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving project timeline",
    });
  }
};

/**
 * Middleware to handle validation errors for ID parameter
 */
export const handleIdValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Invalid project ID",
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
        value: error.value,
      })),
      details: {
        expectedFormat: "MongoDB ObjectId (24 character hex string)",
        example: "507f1f77bcf86cd799439011",
      },
    });
  }
  next();
};
