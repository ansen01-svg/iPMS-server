import ArchiveProject from "../../models//archive-project.model.js";
import MeasurementBook from "../../models/mb.model.js";

const getMeasurementBooks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
    } = req.query;

    // Validate project exists
    const project = await ArchiveProject.findById({ _id: projectId });
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check user authentication
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Build query
    let query = { projectId };

    // Add status filter if provided
    if (status && status !== "all") {
      query.status = status;
    }

    // Add search functionality
    if (search) {
      query.$text = { $search: search };
    }

    // Parse pagination
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Parse sort order
    const sortOrderValue = sortOrder === "desc" ? -1 : 1;

    // Get measurement books with pagination
    const measurementBooks = await MeasurementBook.find(query)
      .populate("project", "projectName workOrderNumber estimatedCost")
      .sort({ [sortBy]: sortOrderValue })
      .skip(skip)
      .limit(limitNumber)
      .lean(); // Use lean() for better performance

    // Get total count for pagination
    const totalCount = await MeasurementBook.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limitNumber);

    // Get status-wise counts for additional info
    const statusCounts = await MeasurementBook.aggregate([
      { $match: { projectId } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    const statusCountsObj = statusCounts.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        measurementBooks,
        pagination: {
          currentPage: pageNumber,
          totalPages,
          totalCount,
          hasNextPage: pageNumber < totalPages,
          hasPrevPage: pageNumber > 1,
          limit: limitNumber,
        },
        project: {
          projectId: project.projectId,
          projectName: project.projectName,
          workOrderNumber: project.workOrderNumber,
        },
        statusCounts: statusCountsObj,
      },
    });
  } catch (error) {
    console.error("Error fetching Measurement Books:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export default getMeasurementBooks;
