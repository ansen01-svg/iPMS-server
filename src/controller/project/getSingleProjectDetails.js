import Project from "../../models/project.model.js";

const getSingleProjectDetails = async (req, res) => {
  const { projectId } = req.params;

  console.log("Fetching project with ID:", projectId);

  try {
    const project = await Project.findOne({ projectId });
    res.status(200).json({
      success: true,
      data: project,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

export default getSingleProjectDetails;
