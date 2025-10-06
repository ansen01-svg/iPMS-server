import Project from "../../models/project.model.js";

const updateEditableStatus = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { isEditable, reason } = req.body;

    // Validate user authentication
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Validate user role - only ADMIN and MD can change editable status
    const allowedRoles = ["MD", "ADMIN", "SUPERADMIN"];
    if (!allowedRoles.includes(req.user.designation)) {
      return res.status(403).json({
        success: false,
        message: `Only ${allowedRoles.join(
          ", "
        )} can change project editable status`,
      });
    }

    // Validate required fields
    if (typeof isEditable !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isEditable must be a boolean value (true or false)",
      });
    }

    // Find the project
    const project = await Project.findById(projectId);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check if the status is actually changing
    if (project.isProjectEditable === isEditable) {
      return res.status(400).json({
        success: false,
        message: `Project is already ${
          isEditable ? "editable" : "non-editable"
        }`,
      });
    }

    // Prepare user info for the method
    const userInfo = {
      userId: req.user.userId,
      name: req.user.fullName || req.user.username,
      role: req.user.designation,
    };

    // Change the editable status using the model method
    await project.changeEditableStatus(isEditable, userInfo, reason || "");

    // Log the change
    console.log(
      `Project ${project.projectId} editable status changed to ${isEditable} by ${userInfo.name} (${userInfo.role})`
    );

    res.status(200).json({
      success: true,
      message: `Project editable status updated to ${
        isEditable ? "editable" : "non-editable"
      } successfully`,
      data: {
        projectId: project.projectId,
        projectName: project.projectName,
        isProjectEditable: project.isProjectEditable,
        updatedBy: {
          name: userInfo.name,
          role: userInfo.role,
        },
        updatedAt: new Date(),
        reason: reason || null,
      },
    });
  } catch (error) {
    console.error("Error updating project editable status:", error);

    // Handle specific error cases
    if (error.message.includes("can change project editable status")) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "Failed to update project editable status",
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

// Additional controller to get editable status history
const getEditableStatusHistory = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    // Validate user authentication
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    // Find the project
    const project = await Project.findById(projectId).select(
      "projectId projectName isProjectEditable editableStatusHistory"
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Pagination logic
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const history = project.editableStatusHistory
      .sort((a, b) => b.changedAt - a.changedAt)
      .slice(skip, skip + parseInt(limit));

    const totalEntries = project.editableStatusHistory.length;

    res.status(200).json({
      success: true,
      data: {
        projectId: project.projectId,
        projectName: project.projectName,
        currentStatus: project.isProjectEditable,
        history,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalEntries / parseInt(limit)),
          totalEntries,
          hasNextPage:
            parseInt(page) < Math.ceil(totalEntries / parseInt(limit)),
          hasPrevPage: parseInt(page) > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching editable status history:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch editable status history",
      error:
        process.env.NODE_ENV === "development"
          ? {
              name: error.name,
              message: error.message,
            }
          : undefined,
    });
  }
};

export { getEditableStatusHistory, updateEditableStatus };
