import mongoose from "mongoose";
import Project from "../../models/project.model.js";

// Update project status
export const updateProjectStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus, remarks, rejectionReason } = req.body;
    const user = req.user;

    // Validate project ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Validate required fields
    if (!newStatus) {
      return res.status(400).json({
        success: false,
        message: "New status is required",
      });
    }

    // Find the project
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check if status is actually changing
    if (project.status === newStatus) {
      return res.status(400).json({
        success: false,
        message: `Project is already in '${newStatus}' status`,
      });
    }

    // Validate rejection reason for rejected statuses
    if (newStatus.includes("Rejected") && !rejectionReason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Rejection reason is required for rejected status",
      });
    }

    // Prepare user info for status change
    const userInfo = {
      userId: user.userId || user.id,
      name: user.fullName || user.name || user.username,
      role: user.designation || user.role,
      ipAddress: req.ip,
      userAgent: req.get("User-Agent"),
    };

    // Validate user role
    const allowedRoles = ["JE", "AEE", "CE", "MD"];
    if (!allowedRoles.includes(userInfo.role)) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized role for status updates",
      });
    }

    try {
      // Change the status using the model method
      await project.changeStatus(
        newStatus,
        userInfo,
        remarks?.trim() || "",
        rejectionReason?.trim() || ""
      );

      // Get updated project with status info
      const updatedProject = await Project.findById(id)
        .select(
          "_id projectId projectName status statusHistory statusWorkflow currentStatusInfo"
        )
        .lean();

      // Log the status change
      console.log(
        `Project status updated: ${project.projectId} from '${
          project.statusHistory[project.statusHistory.length - 2]
            ?.previousStatus || "Unknown"
        }' to '${newStatus}' by ${userInfo.name} (${userInfo.role})`
      );

      res.status(200).json({
        success: true,
        message: `Project status updated to '${newStatus}' successfully`,
        data: {
          project: {
            id: updatedProject._id,
            projectId: updatedProject.projectId,
            projectName: updatedProject.projectName,
            previousStatus:
              project.statusHistory[project.statusHistory.length - 1]
                ?.previousStatus,
            currentStatus: updatedProject.status,
            updatedAt: new Date().toISOString(),
            updatedBy: {
              name: userInfo.name,
              role: userInfo.role,
            },
          },
          statusChange: {
            remarks: remarks?.trim(),
            rejectionReason: newStatus.includes("Rejected")
              ? rejectionReason?.trim()
              : null,
            timestamp: new Date().toISOString(),
          },
        },
      });
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message,
      });
    }
  } catch (error) {
    console.error("Error updating project status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating project status",
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

// Get project status history
export const getProjectStatusHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate project ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Validate pagination parameters
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));

    // Find the project
    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Get status history with pagination
    const statusHistory = project.getStatusHistory(pageNum, limitNum);

    res.status(200).json({
      success: true,
      message: "Project status history retrieved successfully",
      data: {
        projectInfo: {
          id: project._id,
          projectId: project.projectId,
          projectName: project.projectName,
          currentStatus: project.status,
        },
        statusHistory: statusHistory.history,
        pagination: {
          currentPage: statusHistory.currentPage,
          totalPages: statusHistory.totalPages,
          totalEntries: statusHistory.totalEntries,
          hasNextPage: statusHistory.hasNextPage,
          hasPrevPage: statusHistory.hasPrevPage,
          limit: limitNum,
        },
      },
    });
  } catch (error) {
    console.error("Error getting project status history:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving status history",
    });
  }
};

// Get projects by status with filtering
export const getProjectsByStatus = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 10,
      district,
      fund,
      createdBy,
      sortBy = "updatedAt",
      sortOrder = "desc",
    } = req.query;

    // Validate status
    const validStatuses = [
      "Submitted for Approval",
      "Resubmitted for Approval",
      "Rejected by AEE",
      "Rejected by CE",
      "Rejected by MD",
      "Ongoing",
      "Completed",
    ];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
        validStatuses,
      });
    }

    // Validate pagination
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (district) filter.district = district;
    if (fund) filter.fund = fund;
    if (createdBy) filter["createdBy.userId"] = createdBy;

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    // Get projects
    const projects = await Project.find(filter)
      .select(
        "_id projectId projectName status district fund estimatedCost contractorName createdBy statusWorkflow updatedAt"
      )
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count for pagination
    const totalProjects = await Project.countDocuments(filter);

    // Enrich projects with status info
    const enrichedProjects = projects.map((project) => ({
      ...project,
      statusInfo: {
        isRejected: project.status.includes("Rejected"),
        isApproved: project.status === "Ongoing",
        isCompleted: project.status === "Completed",
        isPending: [
          "Submitted for Approval",
          "Resubmitted for Approval",
        ].includes(project.status),
      },
    }));

    res.status(200).json({
      success: true,
      message: `Projects ${
        status ? `with status '${status}'` : ""
      } retrieved successfully`,
      data: {
        projects: enrichedProjects,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalProjects / limitNum),
          totalProjects,
          hasNextPage: pageNum < Math.ceil(totalProjects / limitNum),
          hasPrevPage: pageNum > 1,
          limit: limitNum,
        },
        filters: {
          status,
          district,
          fund,
          createdBy,
          sortBy,
          sortOrder,
        },
      },
    });
  } catch (error) {
    console.error("Error getting projects by status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving projects",
    });
  }
};

// Get status workflow summary for dashboard
export const getStatusSummary = async (req, res) => {
  try {
    const { district, fund, createdBy } = req.query;

    // Build filter
    const filter = {};
    if (district) filter.district = district;
    if (fund) filter.fund = fund;
    if (createdBy) filter["createdBy.userId"] = createdBy;

    // Get status summary using aggregation
    const statusSummary = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalEstimatedCost: { $sum: "$estimatedCost" },
          avgEstimatedCost: { $avg: "$estimatedCost" },
          projects: {
            $push: {
              _id: "$_id",
              projectId: "$projectId",
              projectName: "$projectName",
              estimatedCost: "$estimatedCost",
              district: "$district",
              contractorName: "$contractorName",
              updatedAt: "$updatedAt",
            },
          },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    // Calculate totals
    const totalProjects = statusSummary.reduce(
      (sum, item) => sum + item.count,
      0
    );
    const totalEstimatedCost = statusSummary.reduce(
      (sum, item) => sum + item.totalEstimatedCost,
      0
    );

    // Format summary
    const formattedSummary = statusSummary.map((item) => ({
      status: item._id,
      count: item.count,
      percentage:
        totalProjects > 0 ? Math.round((item.count / totalProjects) * 100) : 0,
      totalEstimatedCost: item.totalEstimatedCost,
      avgEstimatedCost: Math.round(item.avgEstimatedCost),
      costPercentage:
        totalEstimatedCost > 0
          ? Math.round((item.totalEstimatedCost / totalEstimatedCost) * 100)
          : 0,
      recentProjects: item.projects.slice(0, 5), // Show 5 most recent
    }));

    res.status(200).json({
      success: true,
      message: "Status summary retrieved successfully",
      data: {
        summary: formattedSummary,
        totals: {
          totalProjects,
          totalEstimatedCost,
          avgProjectCost:
            totalProjects > 0
              ? Math.round(totalEstimatedCost / totalProjects)
              : 0,
        },
        filters: { district, fund, createdBy },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error getting status summary:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving status summary",
    });
  }
};

// Get user's allowed status transitions for a project
export const getAllowedStatusTransitions = async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.user;

    // Validate project ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Find the project
    const project = await Project.findById(id).select(
      "_id projectId projectName status"
    );
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const userRole = user.designation || user.role;
    const currentStatus = project.status;

    // Define allowed transitions for each role
    const allowedTransitions = {
      JE: {
        "Rejected by AEE": ["Resubmitted for Approval"],
        "Rejected by CE": ["Resubmitted for Approval"],
        "Rejected by MD": ["Resubmitted for Approval"],
        Ongoing: ["Completed"],
      },
      AEE: {
        "Submitted for Approval": ["Rejected by AEE", "Ongoing"],
        "Resubmitted for Approval": ["Rejected by AEE", "Ongoing"],
      },
      CE: {
        "Submitted for Approval": ["Rejected by CE", "Ongoing"],
        "Resubmitted for Approval": ["Rejected by CE", "Ongoing"],
      },
      MD: {
        "Submitted for Approval": ["Rejected by MD", "Ongoing"],
        "Resubmitted for Approval": ["Rejected by MD", "Ongoing"],
      },
    };

    const userAllowedTransitions =
      allowedTransitions[userRole]?.[currentStatus] || [];

    res.status(200).json({
      success: true,
      message: "Allowed status transitions retrieved successfully",
      data: {
        project: {
          id: project._id,
          projectId: project.projectId,
          projectName: project.projectName,
          currentStatus: project.status,
        },
        user: {
          role: userRole,
          canUpdateStatus: userAllowedTransitions.length > 0,
        },
        allowedTransitions: userAllowedTransitions,
        requiresRejectionReason: userAllowedTransitions.some((status) =>
          status.includes("Rejected")
        ),
      },
    });
  } catch (error) {
    console.error("Error getting allowed status transitions:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while retrieving allowed transitions",
    });
  }
};
