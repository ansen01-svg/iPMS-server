import ArchiveProject from "../models/archive-project.model.js";
import Project from "../models/project.model.js";

/**
 * Utility function to find a project by projectId string in either Project or ArchiveProject collections
 * @param {string} projectId - The project ID string to search for (not MongoDB _id)
 * @param {Object} session - Optional MongoDB session for transactions
 * @returns {Object|null} - Returns {project, projectType} or null if not found
 */
export const findProjectByProjectId = async (projectId, session = null) => {
  const options = session ? { session } : {};

  try {
    // First check in Project collection by projectId field
    let project = await Project.findOne({ projectId }, null, options);
    if (project) {
      return {
        project,
        projectType: "Project",
      };
    }

    // If not found in Project, check in ArchiveProject by projectId field
    project = await ArchiveProject.findOne({ projectId }, null, options);
    if (project) {
      return {
        project,
        projectType: "ArchiveProject",
      };
    }

    return null;
  } catch (error) {
    console.error("Error finding project:", error);
    return null;
  }
};

/**
 * Legacy function for backward compatibility (searches by MongoDB _id)
 * @deprecated Use findProjectByProjectId instead
 */
export const findProjectById = async (projectId, session = null) => {
  console.warn(
    "findProjectById is deprecated. Use findProjectByProjectId for projectId string lookup."
  );
  const options = session ? { session } : {};

  try {
    // First check in Project collection
    let project = await Project.findById(projectId, null, options);
    if (project) {
      return {
        project,
        projectType: "Project",
      };
    }

    // If not found in Project, check in ArchiveProject
    project = await ArchiveProject.findById(projectId, null, options);
    if (project) {
      return {
        project,
        projectType: "ArchiveProject",
      };
    }

    return null;
  } catch (error) {
    console.error("Error finding project:", error);
    return null;
  }
};

/**
 * Utility function to find multiple projects by their projectId strings
 * @param {Array} projectIds - Array of project ID strings to search for
 * @param {Object} session - Optional MongoDB session for transactions
 * @returns {Array} - Returns array of {projectId, project, projectType, found}
 */
export const findMultipleProjectsByProjectId = async (
  projectIds,
  session = null
) => {
  const results = [];

  for (const projectId of projectIds) {
    const result = await findProjectByProjectId(projectId, session);
    if (result) {
      results.push({
        projectId,
        project: result.project,
        projectType: result.projectType,
        found: true,
      });
    } else {
      results.push({
        projectId,
        project: null,
        projectType: null,
        found: false,
      });
    }
  }

  return results;
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use findMultipleProjectsByProjectId instead
 */
export const findMultipleProjectsById = async (projectIds, session = null) => {
  console.warn(
    "findMultipleProjectsById is deprecated. Use findMultipleProjectsByProjectId instead."
  );
  const results = [];

  for (const projectId of projectIds) {
    const result = await findProjectById(projectId, session);
    if (result) {
      results.push({
        projectId,
        project: result.project,
        projectType: result.projectType,
        found: true,
      });
    } else {
      results.push({
        projectId,
        project: null,
        projectType: null,
        found: false,
      });
    }
  }

  return results;
};

/**
 * Utility function to validate project existence in batch using projectId strings
 * @param {Array} projectIds - Array of project ID strings to validate
 * @param {Object} session - Optional MongoDB session for transactions
 * @returns {Object} - Returns {valid: [...], invalid: [...]}
 */
export const validateProjectIds = async (projectIds, session = null) => {
  const results = await findMultipleProjectsByProjectId(projectIds, session);

  const valid = results.filter((r) => r.found);
  const invalid = results.filter((r) => !r.found).map((r) => r.projectId);

  return {
    valid,
    invalid,
    validCount: valid.length,
    invalidCount: invalid.length,
    totalCount: projectIds.length,
  };
};

/**
 * Get project details with proper population based on project type using projectId string
 * @param {string} projectId - The project ID string
 * @param {string} projectType - Either "Project" or "ArchiveProject"
 * @param {Object} session - Optional MongoDB session
 * @returns {Object|null} - Populated project object
 */
export const getProjectWithDetailsByProjectId = async (
  projectId,
  projectType,
  session = null
) => {
  const options = session ? { session } : {};

  try {
    if (projectType === "Project") {
      return await Project.findOne({ projectId }, null, options);
    } else if (projectType === "ArchiveProject") {
      return await ArchiveProject.findOne({ projectId }, null, options);
    }
    return null;
  } catch (error) {
    console.error("Error getting project details:", error);
    return null;
  }
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use getProjectWithDetailsByProjectId instead
 */
export const getProjectWithDetails = async (
  projectId,
  projectType,
  session = null
) => {
  console.warn(
    "getProjectWithDetails is deprecated. Use getProjectWithDetailsByProjectId instead."
  );
  const options = session ? { session } : {};

  try {
    if (projectType === "Project") {
      return await Project.findById(projectId, null, options);
    } else if (projectType === "ArchiveProject") {
      return await ArchiveProject.findById(projectId, null, options);
    }
    return null;
  } catch (error) {
    console.error("Error getting project details:", error);
    return null;
  }
};

/**
 * Get unified project fields for both Project and ArchiveProject
 * @param {Object} project - The project object
 * @param {string} projectType - Either "Project" or "ArchiveProject"
 * @returns {Object} - Unified project fields
 */
export const getUnifiedProjectFields = (project, projectType) => {
  if (!project) return null;

  const baseFields = {
    _id: project._id,
    projectType,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };

  if (projectType === "Project") {
    return {
      ...baseFields,
      projectId: project.projectId,
      projectName: project.projectName,
      workOrderNumber: project.workOrderNumber,
      estimatedCost: project.estimatedCost,
      district: project.district,
      contractorName: project.contractorName,
      status: project.status,
      progressPercentage: project.progressPercentage,
      financialProgress: project.financialProgress,
    };
  } else if (projectType === "ArchiveProject") {
    return {
      ...baseFields,
      projectId: project.projectId,
      projectName: project.nameOfWork,
      workOrderNumber: project.FWONumberAndDate,
      estimatedCost: project.workValue,
      district: project.location,
      contractorName: project.nameOfContractor,
      status: "Archive", // Archive projects don't have status field
      progressPercentage: project.progress,
      financialProgress: project.financialProgress,
    };
  }

  return baseFields;
};
