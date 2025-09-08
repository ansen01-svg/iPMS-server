import Project from "../../models/project.model.js";

export const getProjectById = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project id must be provided",
      });
    }

    const project = await Project.findOne({ projectId }).populate([
      {
        path: "subProjects",
        select:
          "projectName estimatedAmount typeOfWork projectStartDate projectEndDate",
      },
    ]);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
        details: {
          searchedId: projectId,
          suggestion: "Please verify the project ID and try again",
        },
      });
    }

    // Calculate virtual fields
    const projectData = project.toJSON();

    // Get progress statuses
    const progressStatus = project.progressStatus;
    const financialProgressStatus = project.financialProgressStatus;

    // Add calculated fields to response including financial progress and contractor info
    const enrichedProject = {
      ...projectData,
      remainingBudget: project.remainingBudget,
      progressStatus,
      financialProgressStatus,
      progressSummary: project.progressSummary,
      projectDurationDays: project.projectDurationDays,
      totalSubProjectsCost: project.totalSubProjectsCost,
      contractorContact: project.contractorContact, // Virtual field for contractor info
      fundDetails: project.fundDetails, // Virtual field for fund details
    };

    // Calculate additional project metrics
    const projectMetrics = {
      daysFromStartToNow: project.projectStartDate
        ? Math.ceil(
            (new Date() - new Date(project.projectStartDate)) /
              (1000 * 60 * 60 * 24)
          )
        : null,
      daysUntilDeadline: project.projectEndDate
        ? Math.ceil(
            (new Date(project.projectEndDate) - new Date()) /
              (1000 * 60 * 60 * 24)
          )
        : null,
      daysWithExtension: project.extensionPeriodForCompletion
        ? Math.ceil(
            (new Date(project.extensionPeriodForCompletion) - new Date()) /
              (1000 * 60 * 60 * 24)
          )
        : null,
      billSubmissionRate:
        project.estimatedCost > 0
          ? Math.round(
              (project.billSubmittedAmount / project.estimatedCost) * 100 * 100
            ) / 100
          : 0,
      isPhysicallyOverdue:
        project.progressPercentage < 100 && project.projectEndDate
          ? new Date() > new Date(project.projectEndDate)
          : false,
      isFinanciallyOverdue:
        project.financialProgress < 100 && project.projectEndDate
          ? new Date() > new Date(project.projectEndDate)
          : false,
      projectAge: project.createdAt
        ? Math.ceil(
            (new Date() - new Date(project.createdAt)) / (1000 * 60 * 60 * 24)
          )
        : 0,
      progressGap: Math.abs(
        (project.progressPercentage || 0) - (project.financialProgress || 0)
      ),
      isFullyComplete:
        (project.progressPercentage || 0) === 100 &&
        (project.financialProgress || 0) === 100,
      hasExtension: !!project.extensionPeriodForCompletion,
      isWithinBudget: project.billSubmittedAmount <= project.estimatedCost,
      budgetUtilization:
        project.estimatedCost > 0
          ? Math.round(
              (project.billSubmittedAmount / project.estimatedCost) * 100
            )
          : 0,
    };

    // Find related projects - include contractor information
    const relatedProjectsPromises = [
      // Projects by same creator
      Project.find({
        "createdBy.userId": project.createdBy.userId,
        _id: { $ne: project._id },
      })
        .select(
          "_id projectName progressPercentage financialProgress estimatedCost status billSubmittedAmount contractorName contractorPhoneNumber"
        )
        .limit(5)
        .sort({ createdAt: -1 }),

      // Projects in same district
      Project.find({
        district: project.district,
        _id: { $ne: project._id },
      })
        .select(
          "_id projectName progressPercentage financialProgress estimatedCost status billSubmittedAmount contractorName contractorPhoneNumber"
        )
        .limit(5)
        .sort({ createdAt: -1 }),

      // Projects with same fund
      Project.find({
        fund: project.fund,
        _id: { $ne: project._id },
      })
        .select(
          "_id projectName progressPercentage financialProgress estimatedCost status billSubmittedAmount contractorName contractorPhoneNumber"
        )
        .limit(5)
        .sort({ createdAt: -1 }),

      // Projects with same type of work
      Project.find({
        typeOfWork: project.typeOfWork,
        _id: { $ne: project._id },
      })
        .select(
          "_id projectName progressPercentage financialProgress estimatedCost status billSubmittedAmount contractorName contractorPhoneNumber"
        )
        .limit(5)
        .sort({ createdAt: -1 }),

      // Projects with same contractor
      Project.find({
        contractorName: project.contractorName,
        _id: { $ne: project._id },
      })
        .select(
          "_id projectName progressPercentage financialProgress estimatedCost status billSubmittedAmount district typeOfWork"
        )
        .limit(5)
        .sort({ createdAt: -1 }),
    ];

    const [
      projectsByCreator,
      projectsByDistrict,
      projectsByFund,
      projectsByType,
      projectsByContractor,
    ] = await Promise.all(relatedProjectsPromises);

    // Enhance related projects with progress summaries
    const enhanceRelatedProjects = (projects) =>
      projects.map((p) => ({
        ...p.toObject(),
        progressSummary: {
          physical: {
            percentage: p.progressPercentage || 0,
            status: getProgressStatus(p.progressPercentage || 0),
          },
          financial: {
            percentage: p.financialProgress || 0,
            status: getProgressStatus(p.financialProgress || 0),
          },
        },
        budgetUtilization:
          p.estimatedCost > 0
            ? Math.round((p.billSubmittedAmount / p.estimatedCost) * 100)
            : 0,
      }));

    // Compile response
    res.status(200).json({
      success: true,
      message: "Project retrieved successfully",
      data: {
        project: enrichedProject,
        metrics: projectMetrics,
        relatedProjects: {
          byCreator: enhanceRelatedProjects(projectsByCreator),
          byDistrict: enhanceRelatedProjects(projectsByDistrict),
          byFund: enhanceRelatedProjects(projectsByFund),
          byType: enhanceRelatedProjects(projectsByType),
          byContractor: enhanceRelatedProjects(projectsByContractor),
        },
      },
      metadata: {
        retrievedAt: new Date().toISOString(),
        projectId: project._id,
        status: project.status,
        lastUpdated: project.updatedAt,
        lastProgressUpdate: project.lastProgressUpdate,
        lastFinancialProgressUpdate: project.lastFinancialProgressUpdate,
        hasSubProjects: project.hasSubProjects,
        subProjectsCount: project.subProjects ? project.subProjects.length : 0,
        contractorInfo: {
          name: project.contractorName,
          phone: project.contractorPhoneNumber,
        },
      },
    });
  } catch (error) {
    console.error("Error retrieving project by ID:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
        details: {
          providedId: req.params.projectId,
          error: error.message,
          expectedFormat: "MongoDB ObjectId (24 character hex string)",
        },
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving project",
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
 * Get project timeline/history
 * GET /api/projects/:id/timeline
 */
export const getProjectTimeline = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findOne({ projectId });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Create timeline events
    const timeline = [];

    // Project creation
    if (project.createdAt) {
      timeline.push({
        date: project.createdAt,
        event: "Project Created",
        description: `Project "${project.projectName}" was created in the system`,
        type: "creation",
        details: {
          creator: project.createdBy.name,
          role: project.createdBy.role,
          contractor: project.contractorName,
        },
      });
    }

    // Work order issue date
    if (project.dateOfIssueOfWorkOrder) {
      timeline.push({
        date: project.dateOfIssueOfWorkOrder,
        event: "Work Order Issued",
        description: `Work Order ${project.workOrderNumber} issued to ${
          project.contractorName
        } for ₹${project.estimatedCost.toLocaleString()}`,
        type: "order",
        details: {
          workOrderNumber: project.workOrderNumber,
          estimatedCost: project.estimatedCost,
          contractorName: project.contractorName,
          contractorPhone: project.contractorPhoneNumber,
          contractorAddress: project.contractorAddress,
        },
      });
    }

    // Project start date
    if (project.projectStartDate) {
      timeline.push({
        date: project.projectStartDate,
        event: "Project Started",
        description: `Project implementation began with contractor ${project.contractorName}`,
        type: "milestone",
        details: {
          duration: project.projectDurationDays,
          endDate: project.projectEndDate,
          contractor: project.contractorName,
        },
      });
    }

    // Progress milestones
    if (project.progressPercentage > 0) {
      const milestones = [25, 50, 75, 100];
      const startDate = project.projectStartDate || project.createdAt;
      const currentDate = new Date();

      milestones.forEach((milestone) => {
        if (project.progressPercentage >= milestone) {
          // Estimate milestone date based on linear progress assumption
          const progressRatio = milestone / 100;
          const estimatedDate = new Date(
            startDate.getTime() +
              (currentDate.getTime() - startDate.getTime()) * progressRatio
          );

          timeline.push({
            date: estimatedDate,
            event: `${milestone}% Physical Progress`,
            description: `Project reached ${milestone}% physical completion`,
            type: "progress",
            estimated: milestone < project.progressPercentage,
            details: {
              milestone,
              progressPercentage: milestone,
              contractor: project.contractorName,
            },
          });
        }
      });
    }

    // Financial progress milestones
    if (project.financialProgress > 0) {
      const milestones = [25, 50, 75, 100];
      const startDate = project.projectStartDate || project.createdAt;
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
            event: `${milestone}% Financial Progress`,
            description: `Project reached ${milestone}% financial completion`,
            type: "financial",
            estimated: milestone < project.financialProgress,
            details: {
              milestone,
              financialPercentage: milestone,
              estimatedAmount: Math.round(
                (milestone / 100) * project.estimatedCost
              ),
              contractor: project.contractorName,
            },
          });
        }
      });
    }

    // Extension period
    if (project.extensionPeriodForCompletion) {
      timeline.push({
        date: project.extensionPeriodForCompletion,
        event: "Extension Granted",
        description: `Project deadline extended for contractor ${project.contractorName}`,
        type: "extension",
        details: {
          originalEndDate: project.projectEndDate,
          extendedEndDate: project.extensionPeriodForCompletion,
          contractor: project.contractorName,
        },
      });
    }

    // Recent progress updates (last 5)
    if (project.progressUpdates && project.progressUpdates.length > 0) {
      const recentUpdates = project.progressUpdates
        .slice(-5)
        .forEach((update) => {
          timeline.push({
            date: update.createdAt,
            event: "Progress Update",
            description: `Progress updated to ${update.newProgress}% by ${update.updatedBy.userName}`,
            type: "update",
            details: {
              previousProgress: update.previousProgress,
              newProgress: update.newProgress,
              updatedBy: update.updatedBy.userName,
              remarks: update.remarks,
              contractor: project.contractorName,
            },
          });
        });
    }

    // Recent financial updates (last 5)
    if (
      project.financialProgressUpdates &&
      project.financialProgressUpdates.length > 0
    ) {
      const recentUpdates = project.financialProgressUpdates
        .slice(-5)
        .forEach((update) => {
          timeline.push({
            date: update.createdAt,
            event: "Financial Update",
            description: `Bill amount updated to ₹${update.newBillAmount.toLocaleString()} by ${
              update.updatedBy.userName
            }`,
            type: "financial_update",
            details: {
              previousAmount: update.previousBillAmount,
              newAmount: update.newBillAmount,
              updatedBy: update.updatedBy.userName,
              remarks: update.remarks,
              billDetails: update.billDetails,
              contractor: project.contractorName,
            },
          });
        });
    }

    // Sort timeline by date
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate project phases and duration
    const duration = {
      totalDays: project.createdAt
        ? Math.ceil(
            (new Date() - new Date(project.createdAt)) / (1000 * 60 * 60 * 24)
          )
        : 0,
      plannedDuration: project.projectDurationDays || 0,
      phases: {
        orderToStart:
          project.dateOfIssueOfWorkOrder && project.projectStartDate
            ? Math.ceil(
                (new Date(project.projectStartDate) -
                  new Date(project.dateOfIssueOfWorkOrder)) /
                  (1000 * 60 * 60 * 24)
              )
            : null,
        startToNow: project.projectStartDate
          ? Math.ceil(
              (new Date() - new Date(project.projectStartDate)) /
                (1000 * 60 * 60 * 24)
            )
          : null,
        remainingDays: project.projectEndDate
          ? Math.ceil(
              (new Date(project.projectEndDate) - new Date()) /
                (1000 * 60 * 60 * 24)
            )
          : null,
      },
    };

    res.status(200).json({
      success: true,
      message: "Project timeline retrieved successfully",
      data: {
        projectId: project._id,
        projectName: project.projectName,
        contractorName: project.contractorName,
        timeline,
        duration,
        currentStatus: {
          physicalProgress: project.progressPercentage,
          financialProgress: project.financialProgress,
          status: project.status,
          progressStatus: project.progressStatus,
          financialProgressStatus: project.financialProgressStatus,
          remainingBudget: project.remainingBudget,
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
