import mongoose from "mongoose";
import ArchiveProject from "../../models/archive-project.model.js";

export const getArchiveProjectByProjectId = async (req, res) => {
  try {
    const { id } = req.params;

    // Validate projectId format (string, non-empty, reasonable length)
    if (!id || typeof id !== "string" || id.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
        details: {
          providedId: projectId,
          expectedFormat: "Non-empty string (e.g., ARC-2023-001, PRJ-2024-001)",
        },
      });
    }

    if (id.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Project ID too long",
        details: {
          providedId: id,
          maxLength: 50,
        },
      });
    }

    const project = await ArchiveProject.findOne({
      projectId: id.trim(),
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Archive project not found",
        details: {
          searchedProjectId: id,
          suggestion: "Please verify the project ID and try again",
        },
      });
    }

    // Calculate virtual fields
    const projectData = project.toJSON();

    // Calculate remaining work value
    const remainingWorkValue = project.remainingWorkValue;

    // Get progress statuses
    const progressStatus = project.progressStatus;
    const financialProgressStatus = project.financialProgressStatus;

    // Calculate financial progress
    const calculatedFinancialProgress = project.calculateFinancialProgress();

    // Add calculated fields to response including financial progress
    const enrichedProject = {
      ...projectData,
      remainingWorkValue,
      progressStatus,
      financialProgressStatus,
      financialProgress:
        project.financialProgress || calculatedFinancialProgress,
      progressSummary: {
        // Combined progress summary
        physical: {
          percentage: project.progress || 0,
          status: progressStatus,
          lastUpdate: project.lastProgressUpdate,
          totalUpdates: project.totalProgressUpdates,
        },
        financial: {
          percentage: project.financialProgress || calculatedFinancialProgress,
          status: financialProgressStatus,
          lastUpdate: project.lastFinancialProgressUpdate,
          totalUpdates: project.totalFinancialProgressUpdates,
          amountSubmitted: project.billSubmittedAmount,
          amountRemaining: remainingWorkValue,
        },
      },
    };

    // Calculate additional project metrics including financial metrics
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
      isPhysicallyOverdue:
        project.progress < 100 && project.FWODate
          ? new Date() - new Date(project.FWODate) > 365 * 24 * 60 * 60 * 1000
          : false,
      isFinanciallyOverdue:
        project.financialProgress < 100 && project.FWODate
          ? new Date() - new Date(project.FWODate) > 365 * 24 * 60 * 60 * 1000
          : false,
      projectAge: project.createdAt
        ? Math.ceil(
            (new Date() - new Date(project.createdAt)) / (1000 * 60 * 60 * 24)
          )
        : 0,
      progressGap: Math.abs(
        (project.progress || 0) - (project.financialProgress || 0)
      ),
      isFullyComplete:
        (project.progress || 0) === 100 &&
        (project.financialProgress || 0) === 100,
    };

    // Find related projects
    const relatedProjectsPromises = [
      ArchiveProject.find({
        nameOfContractor: project.nameOfContractor,
        _id: { $ne: project._id },
      })
        .select(
          "_id projectId nameOfWork progress financialProgress workValue financialYear billSubmittedAmount"
        )
        .limit(5)
        .sort({ createdAt: -1 }),

      ArchiveProject.find({
        concernedEngineer: project.concernedEngineer,
        _id: { $ne: project._id },
      })
        .select(
          "_id projectId nameOfWork progress financialProgress workValue financialYear billSubmittedAmount"
        )
        .limit(5)
        .sort({ createdAt: -1 }),

      ArchiveProject.find({
        location: project.location,
        _id: { $ne: project._id },
      })
        .select(
          "_id projectId nameOfWork progress financialProgress workValue financialYear billSubmittedAmount"
        )
        .limit(5)
        .sort({ createdAt: -1 }),
    ];

    const [projectsByContractor, projectsByEngineer, projectsByLocation] =
      await Promise.all(relatedProjectsPromises);

    // Enhance related projects with progress summaries
    const enhanceRelatedProjects = (projects) =>
      projects.map((p) => ({
        ...p.toObject(),
        progressSummary: {
          physical: {
            percentage: p.progress || 0,
            status: getProgressStatus(p.progress || 0),
          },
          financial: {
            percentage:
              p.financialProgress ||
              (p.workValue > 0
                ? Math.round((p.billSubmittedAmount / p.workValue) * 100)
                : 0),
            status: getProgressStatus(p.financialProgress || 0),
          },
        },
      }));

    // Compile response
    res.status(200).json({
      success: true,
      message: "Archive project retrieved successfully",
      data: {
        project: enrichedProject,
        metrics: projectMetrics,
        relatedProjects: {
          byContractor: enhanceRelatedProjects(projectsByContractor),
          byEngineer: enhanceRelatedProjects(projectsByEngineer),
          byLocation: enhanceRelatedProjects(projectsByLocation),
        },
      },
      metadata: {
        retrievedAt: new Date().toISOString(),
        projectId: project.projectId, // Use projectId string instead of _id
        mongoId: project._id, // Still include MongoDB _id for internal reference
        financialYear: project.financialYear,
        lastUpdated: project.updatedAt,
        lastProgressUpdate: project.lastProgressUpdate,
        lastFinancialProgressUpdate: project.lastFinancialProgressUpdate,
      },
    });
  } catch (error) {
    console.error("Error retrieving archive project by projectId:", error);

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

// Helper function for progress status
function getProgressStatus(progress) {
  if (!progress) return "Not Started";
  if (progress < 25) return "Just Started";
  if (progress < 50) return "In Progress";
  if (progress < 75) return "Halfway Complete";
  if (progress < 100) return "Near Completion";
  return "Completed";
}

/**
 * Get archive project history/timeline by projectId
 * GET /api/archive-projects/:projectId/timeline
 */
export const getArchiveProjectTimeline = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Validate projectId format
    if (
      !projectId ||
      typeof projectId !== "string" ||
      projectId.trim().length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
        details: {
          providedId: projectId,
          expectedFormat: "Non-empty string (e.g., ARC-2023-001)",
        },
      });
    }

    const project = await ArchiveProject.findOne({
      projectId: projectId.trim(),
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Archive project not found",
        details: {
          searchedProjectId: projectId,
          suggestion: "Please verify the project ID and try again",
        },
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

    // Financial progress milestones
    if (project.financialProgress > 0) {
      const milestones = [25, 50, 75, 100];
      const startDate = project.FWODate || project.AADated || project.createdAt;
      const currentDate = new Date();

      milestones.forEach((milestone) => {
        if (project.financialProgress >= milestone) {
          const progressRatio = milestone / 100;
          const estimatedDate = new Date(
            startDate.getTime() +
              (currentDate.getTime() - startDate.getTime()) * progressRatio
          );

          timeline.push({
            date: estimatedDate,
            event: `${milestone}% Financial Progress Milestone`,
            description: `Project reached ${milestone}% financial completion`,
            type: "financial",
            estimated: milestone < project.financialProgress,
            details: {
              milestone,
              financialProgressPercentage: milestone,
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
        projectId: project.projectId, // Use projectId string
        mongoId: project._id, // Include MongoDB _id for reference
        projectName: project.nameOfWork,
        timeline,
        duration,
        currentStatus: {
          progress: project.progress,
          financialProgress: project.financialProgress,
          progressStatus: project.progressStatus,
          financialProgressStatus: project.financialProgressStatus,
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
 * Get archive project by MongoDB _id (for backward compatibility)
 * GET /api/archive-projects/by-id/:id
 */
export const getArchiveProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid MongoDB ObjectId format",
        details: {
          providedId: id,
          expectedFormat: "MongoDB ObjectId (24 character hex string)",
          suggestion:
            "Use /api/archive-projects/:projectId endpoint instead for projectId strings",
        },
      });
    }

    const project = await ArchiveProject.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Archive project not found",
        details: {
          searchedId: id,
          suggestion: "Please verify the MongoDB ObjectId and try again",
        },
      });
    }

    // Redirect to the projectId-based response format
    req.params.projectId = project.projectId;
    return getArchiveProjectByProjectId(req, res);
  } catch (error) {
    console.error("Error retrieving archive project by MongoDB ID:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving archive project",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Middleware to handle validation errors for projectId parameter
 */
export const handleProjectIdValidationErrors = (req, res, next) => {
  const { projectId } = req.params;

  if (
    !projectId ||
    typeof projectId !== "string" ||
    projectId.trim().length === 0
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid project ID",
      details: {
        providedId: projectId,
        expectedFormat: "Non-empty string (e.g., ARC-2023-001, PRJ-2024-001)",
        example: "ARC-2023-001",
      },
    });
  }

  if (projectId.length > 50) {
    return res.status(400).json({
      success: false,
      message: "Project ID too long",
      details: {
        providedId: projectId,
        maxLength: 50,
      },
    });
  }

  next();
};

/**
 * Search archive projects by projectId or name
 * GET /api/archive-projects/search/:searchTerm
 */
export const searchArchiveProjects = async (req, res) => {
  try {
    const { searchTerm } = req.params;
    const { limit = 10 } = req.query;

    if (!searchTerm || searchTerm.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Search term must be at least 2 characters long",
      });
    }

    // Search by projectId (exact match) or nameOfWork (partial match)
    const searchQuery = {
      $or: [
        { projectId: { $regex: searchTerm.trim(), $options: "i" } },
        { nameOfWork: { $regex: searchTerm.trim(), $options: "i" } },
        { nameOfContractor: { $regex: searchTerm.trim(), $options: "i" } },
        { location: { $regex: searchTerm.trim(), $options: "i" } },
      ],
    };

    const projects = await ArchiveProject.find(searchQuery)
      .select(
        "projectId nameOfWork nameOfContractor location workValue progress financialProgress financialYear"
      )
      .limit(parseInt(limit))
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      message: `Found ${projects.length} archive projects matching "${searchTerm}"`,
      data: {
        searchTerm: searchTerm.trim(),
        results: projects,
        count: projects.length,
      },
    });
  } catch (error) {
    console.error("Error searching archive projects:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while searching archive projects",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
