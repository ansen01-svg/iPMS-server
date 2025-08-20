import Project from "../../models/project.model.js";

// GET all projects
const getAllProjects = async (req, res) => {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const userRole = user.designation;
    const userId = user.userId;

    // Get all projects first (single database query)
    const allProjects = await Project.find().sort({ createdAt: -1 });
    let projects;

    switch (userRole) {
      case "JE":
        // Filter and return only the projects created by that JE
        projects = allProjects.filter(
          (project) => project.createdBy?.userId === userId
        );
        break;

      case "AEE":
        // Return all projects
        projects = allProjects;
        break;

      case "CE":
        // Filter and return all projects except those with status = "Submitted to AEE"
        projects = allProjects.filter(
          (project) => project.status !== "Submitted to AEE"
        );
        break;

      case "MD":
        // Filter and return all projects except those with status = "Submitted to AEE" and "Submitted to CE"
        projects = allProjects.filter(
          (project) =>
            project.status !== "Submitted to AEE" &&
            project.status !== "Submitted to CE"
        );
        break;

      case "Executor":
        // Filter and return all projects except those with status = "Submitted to AEE", "Submitted to CE" and "Submitted to MD"
        projects = allProjects.filter(
          (project) =>
            project.status !== "Submitted to AEE" &&
            project.status !== "Submitted to CE" &&
            project.status !== "Submitted to MD"
        );
        break;

      case "Viewer":
        // Filter and return only projects with status = "Approved", "Ongoing" and "Completed"
        projects = allProjects.filter(
          (project) =>
            project.status === "Approved" ||
            project.status === "Ongoing" ||
            project.status === "Completed"
        );
        break;

      case "Administrator":
        // Return all available projects (same as AEE)
        projects = allProjects;
        break;

      default:
        return res.status(403).json({
          success: false,
          message: `Invalid user role: ${userRole}. Access denied.`,
        });
    }

    res.json({
      success: true,
      data: projects,
      count: projects.length,
      userRole: userRole,
    });
  } catch (err) {
    console.error("Error in getProjects:", err);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: err.message,
    });
  }
};

export default getAllProjects;
