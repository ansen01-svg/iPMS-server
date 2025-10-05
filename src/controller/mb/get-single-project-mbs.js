import MeasurementBook from "../../models/mb.model.js";
import {
  findProjectByProjectId,
  getUnifiedProjectFields,
} from "../../utils/projects-filter.js";

/**
 * Get all measurement books for a specific project
 */
const getMeasurementBooksByProject = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = -1,
      mbId,
      mbNo,
      contractor,
    } = req.query;

    // Parse and validate sortOrder
    let validSortOrder = -1;
    if (sortOrder) {
      const parsedSortOrder = parseInt(sortOrder);
      if (!isNaN(parsedSortOrder)) {
        validSortOrder = parsedSortOrder >= 0 ? 1 : -1;
      } else if (typeof sortOrder === "string") {
        validSortOrder = sortOrder.toLowerCase() === "asc" ? 1 : -1;
      }
    }

    // Parse and validate other numeric parameters
    const validPage = Math.max(1, parseInt(page) || 1);
    const validLimit = Math.max(1, Math.min(100, parseInt(limit) || 10));

    // Find the project in either collection using projectId string
    const projectResult = await findProjectByProjectId(projectId);

    if (!projectResult) {
      return res.status(404).json({
        success: false,
        message: `Project with ID '${projectId}' not found in either Project or ArchiveProject collections`,
      });
    }

    const { project, projectType } = projectResult;

    // Build additional query filters
    const additionalFilters = {};
    if (mbId) {
      additionalFilters.mbId = mbId.toUpperCase();
    }
    if (mbNo) {
      additionalFilters.mbNo = { $regex: mbNo, $options: "i" };
    }
    if (contractor) {
      additionalFilters.contractor = { $regex: contractor, $options: "i" };
    }

    // Get measurement books for this project
    const skip = (validPage - 1) * validLimit;
    const query = {
      project: project._id,
      projectType,
      ...additionalFilters,
    };

    const measurementBooks = await MeasurementBook.find(query)
      .populate("project")
      .sort({ [sortBy]: validSortOrder })
      .skip(skip)
      .limit(validLimit)
      .lean();

    const totalCount = await MeasurementBook.countDocuments(query);
    const totalPages = Math.ceil(totalCount / validLimit);

    // Calculate total measurements for this project
    const totalMeasurements = measurementBooks.reduce((sum, mb) => {
      return sum + (mb.measurements?.length || 0);
    }, 0);

    // Get unified project fields
    const unifiedProject = getUnifiedProjectFields(project, projectType);

    res.status(200).json({
      success: true,
      data: {
        measurementBooks: measurementBooks.map((mb) => ({
          ...mb,
          totalMeasurements: mb.measurements?.length || 0,
        })),
        project: unifiedProject,
        pagination: {
          currentPage: validPage,
          totalPages,
          totalCount,
          hasNextPage: validPage < totalPages,
          hasPrevPage: validPage > 1,
          limit: validLimit,
        },
        summary: {
          totalMBs: totalCount,
          totalMeasurementItems: totalMeasurements,
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
