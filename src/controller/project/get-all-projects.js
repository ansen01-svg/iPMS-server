import Project from "../../models/project.model.js";

// GET all projects
const getAllProjects = async (req, res) => {
  try {
    const user = req.user;
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
        // Return all projects
        projects = allProjects;
        break;

      case "MD":
        // Return all projects
        projects = allProjects;
        break;

      case "VIEWER":
        // Filter and return only projects with status = "Ongoing" and "Completed"
        projects = allProjects.filter(
          (project) =>
            project.status === "Ongoing" || project.status === "Completed"
        );
        break;

      case "ADMIN":
        // Return all projects
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
