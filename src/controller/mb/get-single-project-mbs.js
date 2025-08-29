import ArchiveProject from "../../models/archive-project.model.js";
import MeasurementBook from "../../models/mb.model.js";

const getMeasurementBooks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
      search,
      dateFrom,
      dateTo,
      hasRemarks,
      isApproved,
    } = req.query;

    // Validate project ID format
    if (!projectId || projectId.length !== 24) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Validate that project exists
    const project = await ArchiveProject.findById(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Build query
    let query = { project: projectId };

    // Add search functionality (uses text index from schema)
    if (search && search.trim()) {
      query.$text = { $search: search.trim() };
    }

    // Add date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999); // Include the entire end date
        query.createdAt.$lte = endDate;
      }
    }

    // Filter by remarks presence
    if (hasRemarks === "true") {
      query.remarks = { $exists: true, $ne: null, $ne: "" };
    } else if (hasRemarks === "false") {
      query.$or = [
        { remarks: { $exists: false } },
        { remarks: null },
        { remarks: "" },
      ];
    }

    // Filter by approval status
    if (isApproved === "true") {
      query.approvedBy = { $exists: true, $ne: null };
    } else if (isApproved === "false") {
      query.$or = [{ approvedBy: { $exists: false } }, { approvedBy: null }];
    }

    // Parse pagination parameters
    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    // Validate pagination parameters
    if (pageNumber < 1 || limitNumber < 1 || limitNumber > 100) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid pagination parameters. Page must be >= 1, limit must be between 1-100",
      });
    }

    // Parse sort order
    const sortOrderValue = sortOrder === "desc" ? -1 : 1;

    // Validate sortBy field
    const allowedSortFields = ["createdAt", "updatedAt", "description"];
    if (!allowedSortFields.includes(sortBy)) {
      return res.status(400).json({
        success: false,
        message: `Invalid sort field. Allowed fields: ${allowedSortFields.join(
          ", "
        )}`,
      });
    }

    // Execute queries in parallel for better performance
    const [measurementBooks, totalCount] = await Promise.all([
      MeasurementBook.find(query)
        .populate(
          "project",
          "projectName workOrderNumber estimatedCost district"
        )
        .sort({ [sortBy]: sortOrderValue })
        .skip(skip)
        .limit(limitNumber)
        .lean(), // Use lean() for better performance
      MeasurementBook.countDocuments(query),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limitNumber);

    // Get summary statistics
    const summaryStats = await MeasurementBook.aggregate([
      { $match: { project: project._id } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          withRemarks: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$remarks", null] },
                    { $ne: ["$remarks", ""] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          approved: {
            $sum: {
              $cond: [{ $ne: ["$approvedBy", null] }, 1, 0],
            },
          },
          totalFileSize: { $sum: "$uploadedFile.fileSize" },
          avgFileSize: { $avg: "$uploadedFile.fileSize" },
        },
      },
    ]);

    const stats = summaryStats[0] || {
      total: 0,
      withRemarks: 0,
      approved: 0,
      totalFileSize: 0,
      avgFileSize: 0,
    };

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
          id: project._id,
          projectName: project.projectName,
          workOrderNumber: project.workOrderNumber,
        },
        summary: {
          totalMBs: stats.total,
          withRemarks: stats.withRemarks,
          approved: stats.approved,
          totalFileSize: stats.totalFileSize,
          avgFileSize: Math.round(stats.avgFileSize || 0),
          humanReadableTotalSize: formatFileSize(stats.totalFileSize || 0),
        },
        filters: {
          search: search || null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
          hasRemarks: hasRemarks || null,
          isApproved: isApproved || null,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching Measurement Books:", error);

    // Handle cast errors
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
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

// Helper function to format file size
const formatFileSize = (bytes) => {
  if (bytes === 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + " " + sizes[i];
};

export default getMeasurementBooks;
