import MeasurementBook from "../../models/mb.model.js";

/**
 * Get all measurement books with filtering and pagination
 */
const getAllMeasurementBooks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = -1,
      projectType,
      search,
      createdBy,
      mbId,
      mbNo,
      contractor,
      location,
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
    const skip = (validPage - 1) * validLimit;

    // Build query
    const query = {};

    if (projectType && ["Project", "ArchiveProject"].includes(projectType)) {
      query.projectType = projectType;
    }

    if (createdBy) {
      query["createdBy.userId"] = createdBy;
    }

    if (mbId) {
      query.mbId = mbId.toUpperCase();
    }

    if (mbNo) {
      query.mbNo = { $regex: mbNo, $options: "i" };
    }

    if (contractor) {
      query.contractor = { $regex: contractor, $options: "i" };
    }

    if (location) {
      query.location = { $regex: location, $options: "i" };
    }

    if (search) {
      query.$text = { $search: search };
    }

    // Get measurement books with pagination
    const measurementBooks = await MeasurementBook.find(query)
      .populate("project")
      .sort({ [sortBy]: validSortOrder })
      .skip(skip)
      .limit(validLimit)
      .lean();

    const totalCount = await MeasurementBook.countDocuments(query);
    const totalPages = Math.ceil(totalCount / validLimit);

    // Group by project type for summary
    const projectTypeSummary = await MeasurementBook.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$projectType",
          count: { $sum: 1 },
        },
      },
    ]);

    // Calculate total measurements across all MBs
    const totalMeasurements = measurementBooks.reduce((sum, mb) => {
      return sum + (mb.measurements?.length || 0);
    }, 0);

    res.status(200).json({
      success: true,
      data: {
        measurementBooks: measurementBooks.map((mb) => ({
          ...mb,
          totalMeasurements: mb.measurements?.length || 0,
        })),
        pagination: {
          currentPage: validPage,
          totalPages,
          totalCount,
          hasNextPage: validPage < totalPages,
          hasPrevPage: validPage > 1,
          limit: validLimit,
        },
        summary: {
          total: totalCount,
          totalMeasurementItems: totalMeasurements,
          byProjectType: projectTypeSummary.reduce((acc, item) => {
            acc[item._id] = item.count;
            return acc;
          }, {}),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching all measurement books:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid query parameters",
        details:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export default getAllMeasurementBooks;
