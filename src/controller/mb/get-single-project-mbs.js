import MeasurementBook from "../../models/mb.model.js";
import {
  findProjectByProjectId,
  getUnifiedProjectFields,
} from "../../utils/projects-filter.js";

const getMeasurementBooksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = -1,
    } = req.query;

    // Parse and validate sortOrder - ensure it's always 1 or -1
    let validSortOrder = -1; // default to descending
    if (sortOrder) {
      const parsedSortOrder = parseInt(sortOrder);
      if (!isNaN(parsedSortOrder)) {
        validSortOrder = parsedSortOrder >= 0 ? 1 : -1;
      } else if (typeof sortOrder === "string") {
        // Handle string values like 'asc', 'desc'
        validSortOrder = sortOrder.toLowerCase() === "asc" ? 1 : -1;
      }
    }

    // Parse and validate other numeric parameters
    const validPage = Math.max(1, parseInt(page) || 1);
    const validLimit = Math.max(1, Math.min(100, parseInt(limit) || 10)); // Cap limit at 100

    // Find the project in either collection using projectId string
    const projectResult = await findProjectByProjectId(projectId);

    if (!projectResult) {
      return res.status(404).json({
        success: false,
        message: `Project with ID '${projectId}' not found in either Project or ArchiveProject collections`,
      });
    }

    const { project, projectType } = projectResult;

    // Get measurement books for this project (using MongoDB ObjectId for efficient query)
    const measurementBooks = await MeasurementBook.findByProject(
      project._id, // Use MongoDB ObjectId for database query
      projectType,
      {
        page: validPage,
        limit: validLimit,
        sortBy,
        sortOrder: validSortOrder, // Use validated sort order
      }
    );

    const totalCount = await MeasurementBook.countByProject(
      project._id,
      projectType
    );
    const totalPages = Math.ceil(totalCount / validLimit);

    // Get unified project fields
    const unifiedProject = getUnifiedProjectFields(project, projectType);

    res.status(200).json({
      success: true,
      data: {
        measurementBooks,
        project: unifiedProject,
        pagination: {
          currentPage: validPage,
          totalPages,
          totalCount,
          hasNextPage: validPage < totalPages,
          hasPrevPage: validPage > 1,
          limit: validLimit,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching measurement books:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export default getMeasurementBooksByProject;
