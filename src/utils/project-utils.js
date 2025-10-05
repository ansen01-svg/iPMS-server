import ArchiveProject from "../models/archive-project.model.js";
import Project from "../models/project.model.js";

/**
 * Find a single project by projectId string in either Project or ArchiveProject collection
 * @param {string} projectId - The project ID string to search for
 * @param {object} session - Optional MongoDB session for transactions
 * @returns {Promise<{project: object, projectType: string} | null>}
 */
export const findProjectByProjectId = async (projectId, session = null) => {
  try {
    const options = session ? { session } : {};

    // First, try to find in Project collection
    let project = await Project.findOne({ projectId }).session(
      session || undefined
    );

    if (project) {
      return {
        project,
        projectType: "Project",
      };
    }

    // If not found, try ArchiveProject collection
    project = await ArchiveProject.findOne({ projectId }).session(
      session || undefined
    );

    if (project) {
      return {
        project,
        projectType: "ArchiveProject",
      };
    }

    // Not found in either collection
    return null;
  } catch (error) {
    console.error(`Error finding project by projectId ${projectId}:`, error);
    throw error;
  }
};

/**
 * Find multiple projects by their projectId strings
 * @param {string[]} projectIds - Array of project ID strings
 * @param {object} session - Optional MongoDB session for transactions
 * @returns {Promise<Array<{projectId: string, found: boolean, project?: object, projectType?: string}>>}
 */
export const findMultipleProjectsByProjectId = async (
  projectIds,
  session = null
) => {
  try {
    const results = [];

    for (const projectId of projectIds) {
      try {
        const result = await findProjectByProjectId(projectId, session);

        if (result) {
          results.push({
            projectId,
            found: true,
            project: result.project,
            projectType: result.projectType,
          });
        } else {
          results.push({
            projectId,
            found: false,
          });
        }
      } catch (error) {
        console.error(`Error finding project with ID ${projectId}:`, error);
        results.push({
          projectId,
          found: false,
          error: error.message,
        });
      }
    }

    return results;
  } catch (error) {
    console.error("Error in findMultipleProjectsByProjectId:", error);
    throw error;
  }
};

/**
 * Check if a project exists by projectId
 * @param {string} projectId - The project ID string
 * @param {object} session - Optional MongoDB session
 * @returns {Promise<boolean>}
 */
export const projectExists = async (projectId, session = null) => {
  try {
    const result = await findProjectByProjectId(projectId, session);
    return result !== null;
  } catch (error) {
    console.error(`Error checking if project exists: ${projectId}:`, error);
    return false;
  }
};

/**
 * Get project type for a given projectId
 * @param {string} projectId - The project ID string
 * @param {object} session - Optional MongoDB session
 * @returns {Promise<"Project" | "ArchiveProject" | null>}
 */
export const getProjectType = async (projectId, session = null) => {
  try {
    const result = await findProjectByProjectId(projectId, session);
    return result ? result.projectType : null;
  } catch (error) {
    console.error(`Error getting project type for ${projectId}:`, error);
    return null;
  }
};

/**
 * Validate project IDs and return detailed results
 * @param {string[]} projectIds - Array of project IDs to validate
 * @param {object} session - Optional MongoDB session
 * @returns {Promise<{valid: Array, invalid: Array, summary: object}>}
 */
export const validateProjectIds = async (projectIds, session = null) => {
  try {
    const validationResults = await findMultipleProjectsByProjectId(
      projectIds,
      session
    );

    const valid = validationResults.filter((r) => r.found);
    const invalid = validationResults.filter((r) => !r.found);

    return {
      valid,
      invalid,
      summary: {
        total: projectIds.length,
        validCount: valid.length,
        invalidCount: invalid.length,
        validProjectIds: valid.map((v) => v.projectId),
        invalidProjectIds: invalid.map((i) => i.projectId),
      },
    };
  } catch (error) {
    console.error("Error validating project IDs:", error);
    throw error;
  }
};

/**
 * Get project details with unified field names
 * @param {string} projectId - The project ID string
 * @param {object} session - Optional MongoDB session
 * @returns {Promise<object | null>}
 */
export const getUnifiedProjectDetails = async (projectId, session = null) => {
  try {
    const result = await findProjectByProjectId(projectId, session);

    if (!result) {
      return null;
    }

    const { project, projectType } = result;

    // Return unified structure regardless of project type
    if (projectType === "Project") {
      return {
        projectId: project.projectId,
        name: project.projectName,
        contractor: project.contractorName,
        contractorPhone: project.contractorPhoneNumber,
        contractorAddress: project.contractorAddress,
        location: project.district,
        workValue: project.estimatedCost,
        startDate: project.projectStartDate,
        endDate: project.projectEndDate,
        workOrderNumber: project.workOrderNumber,
        fund: project.fund,
        subFund: project.subFund,
        projectType: "Project",
        _id: project._id,
      };
    } else {
      // ArchiveProject
      return {
        projectId: project.projectId,
        name: project.nameOfWork,
        contractor: project.nameOfContractor,
        contractorPhone: undefined,
        contractorAddress: undefined,
        location: project.location,
        workValue: project.workValue,
        startDate: project.FWODate || project.AADated,
        endDate: undefined,
        workOrderNumber: project.FWONumberAndDate,
        fund: undefined,
        subFund: undefined,
        projectType: "ArchiveProject",
        _id: project._id,
      };
    }
  } catch (error) {
    console.error(
      `Error getting unified project details for ${projectId}:`,
      error
    );
    throw error;
  }
};

/**
 * Batch get project details for multiple projectIds
 * @param {string[]} projectIds - Array of project IDs
 * @param {object} session - Optional MongoDB session
 * @returns {Promise<Array<object>>}
 */
export const batchGetProjectDetails = async (projectIds, session = null) => {
  try {
    const results = await findMultipleProjectsByProjectId(projectIds, session);

    return results.map((result) => {
      if (!result.found) {
        return {
          projectId: result.projectId,
          found: false,
          details: null,
        };
      }

      const { project, projectType } = result;

      const details =
        projectType === "Project"
          ? {
              projectId: project.projectId,
              name: project.projectName,
              contractor: project.contractorName,
              location: project.district,
              workValue: project.estimatedCost,
              projectType: "Project",
            }
          : {
              projectId: project.projectId,
              name: project.nameOfWork,
              contractor: project.nameOfContractor,
              location: project.location,
              workValue: project.workValue,
              projectType: "ArchiveProject",
            };

      return {
        projectId: result.projectId,
        found: true,
        details,
        projectType,
      };
    });
  } catch (error) {
    console.error("Error in batchGetProjectDetails:", error);
    throw error;
  }
};

/**
 * Find project by MongoDB ObjectId in either collection
 * @param {string} objectId - MongoDB ObjectId string
 * @param {object} session - Optional MongoDB session
 * @returns {Promise<{project: object, projectType: string} | null>}
 */
export const findProjectByObjectId = async (objectId, session = null) => {
  try {
    // Try Project collection first
    let project = await Project.findById(objectId).session(
      session || undefined
    );

    if (project) {
      return {
        project,
        projectType: "Project",
      };
    }

    // Try ArchiveProject collection
    project = await ArchiveProject.findById(objectId).session(
      session || undefined
    );

    if (project) {
      return {
        project,
        projectType: "ArchiveProject",
      };
    }

    return null;
  } catch (error) {
    console.error(`Error finding project by ObjectId ${objectId}:`, error);
    throw error;
  }
};

/**
 * Get projects count by type
 * @returns {Promise<{Project: number, ArchiveProject: number, total: number}>}
 */
export const getProjectsCount = async () => {
  try {
    const [projectCount, archiveProjectCount] = await Promise.all([
      Project.countDocuments(),
      ArchiveProject.countDocuments(),
    ]);

    return {
      Project: projectCount,
      ArchiveProject: archiveProjectCount,
      total: projectCount + archiveProjectCount,
    };
  } catch (error) {
    console.error("Error getting projects count:", error);
    throw error;
  }
};

/**
 * Search projects across both collections by name or ID
 * @param {string} searchTerm - Search term
 * @param {number} limit - Maximum results to return
 * @returns {Promise<Array>}
 */
export const searchProjects = async (searchTerm, limit = 10) => {
  try {
    if (!searchTerm || searchTerm.trim().length < 2) {
      return [];
    }

    const searchRegex = new RegExp(searchTerm, "i");

    // Search in both collections
    const [projects, archiveProjects] = await Promise.all([
      Project.find({
        $or: [
          { projectId: searchRegex },
          { projectName: searchRegex },
          { contractorName: searchRegex },
        ],
      })
        .limit(limit)
        .lean(),
      ArchiveProject.find({
        $or: [
          { projectId: searchRegex },
          { nameOfWork: searchRegex },
          { nameOfContractor: searchRegex },
        ],
      })
        .limit(limit)
        .lean(),
    ]);

    // Combine and format results
    const results = [
      ...projects.map((p) => ({
        projectId: p.projectId,
        name: p.projectName,
        contractor: p.contractorName,
        location: p.district,
        projectType: "Project",
        _id: p._id,
      })),
      ...archiveProjects.map((p) => ({
        projectId: p.projectId,
        name: p.nameOfWork,
        contractor: p.nameOfContractor,
        location: p.location,
        projectType: "ArchiveProject",
        _id: p._id,
      })),
    ];

    return results.slice(0, limit);
  } catch (error) {
    console.error("Error searching projects:", error);
    throw error;
  }
};

/**
 * Get project by ID with error handling
 * Throws descriptive error if project not found
 * @param {string} projectId - Project ID string
 * @param {object} session - Optional MongoDB session
 * @returns {Promise<{project: object, projectType: string}>}
 * @throws {Error} If project not found
 */
export const getProjectOrFail = async (projectId, session = null) => {
  const result = await findProjectByProjectId(projectId, session);

  if (!result) {
    throw new Error(
      `Project with ID '${projectId}' not found in either Project or ArchiveProject collections`
    );
  }

  return result;
};

/**
 * Bulk validate and get projects
 * Returns both validation results and project details in one call
 * @param {string[]} projectIds - Array of project IDs
 * @param {object} session - Optional MongoDB session
 * @returns {Promise<{valid: Array, invalid: Array, projects: Map}>}
 */
export const bulkValidateAndGetProjects = async (
  projectIds,
  session = null
) => {
  try {
    const results = await findMultipleProjectsByProjectId(projectIds, session);

    const valid = [];
    const invalid = [];
    const projectsMap = new Map();

    results.forEach((result) => {
      if (result.found) {
        valid.push({
          projectId: result.projectId,
          projectType: result.projectType,
          _id: result.project._id,
        });
        projectsMap.set(result.projectId, {
          project: result.project,
          projectType: result.projectType,
        });
      } else {
        invalid.push({
          projectId: result.projectId,
          error: result.error || "Project not found",
        });
      }
    });

    return {
      valid,
      invalid,
      projects: projectsMap,
      summary: {
        total: projectIds.length,
        validCount: valid.length,
        invalidCount: invalid.length,
      },
    };
  } catch (error) {
    console.error("Error in bulkValidateAndGetProjects:", error);
    throw error;
  }
};

export default {
  findProjectByProjectId,
  findMultipleProjectsByProjectId,
  projectExists,
  getProjectType,
  validateProjectIds,
  getUnifiedProjectDetails,
  batchGetProjectDetails,
  findProjectByObjectId,
  getProjectsCount,
  searchProjects,
  getProjectOrFail,
  bulkValidateAndGetProjects,
};
