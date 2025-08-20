import Project from "../../models/project.model.js";

const createProject = async (req, res) => {
  try {
    const {
      geoLocation,
      typeOfWork,
      dateOfProposal,
      projectName,
      description,
      hasSubProjects,
      fund,
      function: projectFunction,
      budgetHead,
      scheme,
      subScheme,
      owningDepartment,
      executingDepartment,
      beneficiary,
      letterReference,
      estimatedCost,
      subTypeOfWork,
      natureOfWork,
      projectStartDate,
      projectEndDate,
      recommendedModeOfExecution,
      // locality,
      // ward,
      // ulb,
      district,
      block,
      gramPanchayat,
      subProjects,
      uploadedFiles,
    } = req.body;

    // Validate geoLocation
    if (
      !geoLocation ||
      geoLocation.latitude === undefined ||
      geoLocation.longitude === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "geoLocation with latitude & longitude is required",
      });
    }

    const utcTimestamp = Date.now();
    const createdAt = new Date();
    const projectId = `${typeOfWork}_${utcTimestamp}`;

    const user = await getUserFromToken(req);

    const project = new Project({
      dateOfProposal,
      projectName,
      description,
      hasSubProjects,
      fund,
      function: projectFunction,
      budgetHead,
      scheme,
      subScheme,
      owningDepartment,
      executingDepartment,
      beneficiary,
      letterReference,
      estimatedCost,
      typeOfWork,
      subTypeOfWork,
      natureOfWork,
      projectStartDate,
      projectEndDate,
      recommendedModeOfExecution,
      // locality,
      // ward,
      // ulb,
      district,
      block,
      gramPanchayat,
      subProjects: subProjects || [],
      uploadedFiles: uploadedFiles || [],
      geoLocation: {
        type: "Point",
        coordinates: [
          parseFloat(geoLocation.longitude),
          parseFloat(geoLocation.latitude),
        ],
      },
      id: utcTimestamp,
      projectId,
      createdAt,
      createdBy: {
        userId: user.userId,
        name: user.username,
        role: user.designation,
      },
    });

    await project.save();

    res.status(201).json({
      success: true,
      data: {
        projectId,
        status: "created",
        createdAt,
        project,
      },
    });
  } catch (err) {
    console.error("Error creating project:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

export default createProject;
