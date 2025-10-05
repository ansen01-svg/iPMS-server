import ArchiveProject from "../models/archive-project.model.js";
import Project from "../models/project.model.js";

/**
 * Find project by projectId string in either collection
 * @param {string} projectId - The project ID string to search for
 * @param {object} session - Optional MongoDB session for transactions
 * @returns {Promise<{project: object, projectType: string} | null>}
 */
export const findProjectByProjectId = async (projectId, session = null) => {
  try {
    // Search in Project collection
    let project = await Project.findOne({ projectId }).session(
      session || undefined
    );

    if (project) {
      return {
        project,
        projectType: "Project",
      };
    }

    // Search in ArchiveProject collection
    project = await ArchiveProject.findOne({ projectId }).session(
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
    console.error(`Error finding project by projectId ${projectId}:`, error);
    throw error;
  }
};

/**
 * Get unified project fields regardless of project type
 * Normalizes field names between Project and ArchiveProject
 * @param {object} project - The project object
 * @param {string} projectType - "Project" or "ArchiveProject"
 * @returns {object} Unified project fields
 */
export const getUnifiedProjectFields = (project, projectType) => {
  if (projectType === "Project") {
    return {
      _id: project._id,
      projectId: project.projectId,
      projectType: "Project",

      // Basic info
      name: project.projectName,
      nameOfWork: project.projectName,

      // Contractor
      contractor: project.contractorName,
      contractorName: project.contractorName,
      contractorPhone: project.contractorPhoneNumber,
      contractorAddress: project.contractorAddress,

      // Location
      location: project.district,
      district: project.district,
      state: project.state,

      // Financial
      workValue: project.estimatedCost,
      estimatedCost: project.estimatedCost,
      billSubmittedAmount: project.billSubmittedAmount,

      // Dates
      startDate: project.projectStartDate,
      endDate: project.projectEndDate,

      // Work order
      workOrderNumber: project.workOrderNumber,
      workOrderDate: project.workOrderDate,

      // Funding
      fund: project.fund,
      subFund: project.subFund,

      // Progress
      progress: project.progressPercentage || project.progress,
      progressPercentage: project.progressPercentage,
      physicalProgress: project.progressPercentage,
      financialProgress: project.financialProgress,

      // Status
      status: project.status,

      // Other fields
      description: project.description,
      remarks: project.remarks,

      // Timestamps
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  } else {
    // ArchiveProject
    return {
      _id: project._id,
      projectId: project.projectId,
      projectType: "ArchiveProject",

      // Basic info
      name: project.nameOfWork,
      nameOfWork: project.nameOfWork,

      // Contractor
      contractor: project.nameOfContractor,
      contractorName: project.nameOfContractor,
      contractorPhone: undefined,
      contractorAddress: undefined,

      // Location
      location: project.location,
      district: project.location,
      state: undefined,

      // Financial
      workValue: project.workValue,
      estimatedCost: project.workValue,
      billSubmittedAmount: project.billSubmittedAmount,

      // Dates
      startDate: project.FWODate || project.AADated,
      endDate: undefined,

      // Work order
      workOrderNumber: project.FWONumberAndDate,
      workOrderDate: project.FWODate,

      // Funding
      fund: undefined,
      subFund: undefined,

      // Progress
      progress: project.progress,
      progressPercentage: project.progress,
      physicalProgress: project.progress,
      financialProgress: project.financialProgress,

      // Status
      status: project.status,

      // Other fields
      description: undefined,
      remarks: project.remarks,

      // Timestamps
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
};

/**
 * Filter projects based on query parameters
 * Works with both Project and ArchiveProject
 * @param {object} filters - Filter parameters
 * @param {string} collectionType - "Project" | "ArchiveProject" | "both"
 * @returns {Promise<Array>} Filtered projects
 */
export const filterProjects = async (filters = {}, collectionType = "both") => {
  const {
    search,
    contractor,
    location,
    minWorkValue,
    maxWorkValue,
    startDateFrom,
    startDateTo,
    status,
    fund,
    limit = 50,
    skip = 0,
  } = filters;

  const buildQuery = (isArchive = false) => {
    const query = {};

    // Text search
    if (search) {
      if (isArchive) {
        query.$or = [
          { projectId: { $regex: search, $options: "i" } },
          { nameOfWork: { $regex: search, $options: "i" } },
          { nameOfContractor: { $regex: search, $options: "i" } },
          { location: { $regex: search, $options: "i" } },
        ];
      } else {
        query.$or = [
          { projectId: { $regex: search, $options: "i" } },
          { projectName: { $regex: search, $options: "i" } },
          { contractorName: { $regex: search, $options: "i" } },
          { district: { $regex: search, $options: "i" } },
        ];
      }
    }

    // Contractor filter
    if (contractor) {
      const contractorField = isArchive ? "nameOfContractor" : "contractorName";
      query[contractorField] = { $regex: contractor, $options: "i" };
    }

    // Location filter
    if (location) {
      const locationField = isArchive ? "location" : "district";
      query[locationField] = { $regex: location, $options: "i" };
    }

    // Work value filter
    if (minWorkValue || maxWorkValue) {
      const valueField = isArchive ? "workValue" : "estimatedCost";
      query[valueField] = {};
      if (minWorkValue) query[valueField].$gte = Number(minWorkValue);
      if (maxWorkValue) query[valueField].$lte = Number(maxWorkValue);
    }

    // Date filter
    if (startDateFrom || startDateTo) {
      const dateField = isArchive ? "FWODate" : "projectStartDate";
      query[dateField] = {};
      if (startDateFrom) query[dateField].$gte = new Date(startDateFrom);
      if (startDateTo) query[dateField].$lte = new Date(startDateTo);
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Fund filter (only for Project, not ArchiveProject)
    if (fund && !isArchive) {
      query.fund = fund;
    }

    return query;
  };

  try {
    let results = [];

    if (collectionType === "both" || collectionType === "Project") {
      const projectQuery = buildQuery(false);
      const projects = await Project.find(projectQuery)
        .limit(limit)
        .skip(skip)
        .lean();

      results = [
        ...results,
        ...projects.map((p) => getUnifiedProjectFields(p, "Project")),
      ];
    }

    if (collectionType === "both" || collectionType === "ArchiveProject") {
      const archiveQuery = buildQuery(true);
      const archiveProjects = await ArchiveProject.find(archiveQuery)
        .limit(limit)
        .skip(skip)
        .lean();

      results = [
        ...results,
        ...archiveProjects.map((p) =>
          getUnifiedProjectFields(p, "ArchiveProject")
        ),
      ];
    }

    return results;
  } catch (error) {
    console.error("Error filtering projects:", error);
    throw error;
  }
};

/**
 * Get projects statistics
 * @param {object} filters - Optional filters
 * @returns {Promise<object>} Statistics
 */
export const getProjectsStatistics = async (filters = {}) => {
  try {
    const projects = await filterProjects(filters, "both");

    const stats = {
      totalProjects: projects.length,
      byType: {
        Project: projects.filter((p) => p.projectType === "Project").length,
        ArchiveProject: projects.filter(
          (p) => p.projectType === "ArchiveProject"
        ).length,
      },
      totalWorkValue: projects.reduce((sum, p) => sum + (p.workValue || 0), 0),
      averageWorkValue:
        projects.length > 0
          ? projects.reduce((sum, p) => sum + (p.workValue || 0), 0) /
            projects.length
          : 0,
      totalBillAmount: projects.reduce(
        (sum, p) => sum + (p.billSubmittedAmount || 0),
        0
      ),
      byStatus: {},
      byLocation: {},
      byContractor: {},
    };

    // Group by status
    projects.forEach((p) => {
      if (p.status) {
        stats.byStatus[p.status] = (stats.byStatus[p.status] || 0) + 1;
      }
    });

    // Group by location
    projects.forEach((p) => {
      if (p.location) {
        stats.byLocation[p.location] = (stats.byLocation[p.location] || 0) + 1;
      }
    });

    // Group by contractor
    projects.forEach((p) => {
      if (p.contractor) {
        stats.byContractor[p.contractor] =
          (stats.byContractor[p.contractor] || 0) + 1;
      }
    });

    return stats;
  } catch (error) {
    console.error("Error getting project statistics:", error);
    throw error;
  }
};

/**
 * Get all unique values for a field across both collections
 * Useful for dropdown filters
 * @param {string} field - Field name (unified field name)
 * @returns {Promise<Array>} Unique values
 */
export const getUniqueFieldValues = async (field) => {
  try {
    const fieldMapping = {
      contractor: {
        Project: "contractorName",
        ArchiveProject: "nameOfContractor",
      },
      location: {
        Project: "district",
        ArchiveProject: "location",
      },
      name: {
        Project: "projectName",
        ArchiveProject: "nameOfWork",
      },
      status: {
        Project: "status",
        ArchiveProject: "status",
      },
      fund: {
        Project: "fund",
        ArchiveProject: null, // Not available in ArchiveProject
      },
    };

    const mapping = fieldMapping[field];
    if (!mapping) {
      throw new Error(`Field ${field} is not supported`);
    }

    const uniqueValues = new Set();

    // Get values from Project collection
    if (mapping.Project) {
      const projectValues = await Project.distinct(mapping.Project);
      projectValues.forEach((v) => v && uniqueValues.add(v));
    }

    // Get values from ArchiveProject collection
    if (mapping.ArchiveProject) {
      const archiveValues = await ArchiveProject.distinct(
        mapping.ArchiveProject
      );
      archiveValues.forEach((v) => v && uniqueValues.add(v));
    }

    return Array.from(uniqueValues).sort();
  } catch (error) {
    console.error(`Error getting unique values for field ${field}:`, error);
    throw error;
  }
};

/**
 * Search projects with autocomplete
 * @param {string} searchTerm - Search term
 * @param {string} field - Field to search in
 * @param {number} limit - Maximum results
 * @returns {Promise<Array>} Matching values
 */
export const autocompleteSearch = async (
  searchTerm,
  field = "name",
  limit = 10
) => {
  try {
    if (!searchTerm || searchTerm.length < 2) {
      return [];
    }

    const fieldMapping = {
      name: {
        Project: "projectName",
        ArchiveProject: "nameOfWork",
      },
      contractor: {
        Project: "contractorName",
        ArchiveProject: "nameOfContractor",
      },
      location: {
        Project: "district",
        ArchiveProject: "location",
      },
      projectId: {
        Project: "projectId",
        ArchiveProject: "projectId",
      },
    };

    const mapping = fieldMapping[field];
    if (!mapping) {
      return [];
    }

    const regex = new RegExp(searchTerm, "i");
    const results = [];

    // Search in Project collection
    if (mapping.Project) {
      const projects = await Project.find({
        [mapping.Project]: regex,
      })
        .select(`projectId ${mapping.Project}`)
        .limit(limit)
        .lean();

      results.push(
        ...projects.map((p) => ({
          projectId: p.projectId,
          value: p[mapping.Project],
          type: "Project",
        }))
      );
    }

    // Search in ArchiveProject collection
    if (mapping.ArchiveProject && results.length < limit) {
      const archiveProjects = await ArchiveProject.find({
        [mapping.ArchiveProject]: regex,
      })
        .select(`projectId ${mapping.ArchiveProject}`)
        .limit(limit - results.length)
        .lean();

      results.push(
        ...archiveProjects.map((p) => ({
          projectId: p.projectId,
          value: p[mapping.ArchiveProject],
          type: "ArchiveProject",
        }))
      );
    }

    return results.slice(0, limit);
  } catch (error) {
    console.error("Error in autocomplete search:", error);
    throw error;
  }
};

export default {
  findProjectByProjectId,
  getUnifiedProjectFields,
  filterProjects,
  getProjectsStatistics,
  getUniqueFieldValues,
  autocompleteSearch,
};
