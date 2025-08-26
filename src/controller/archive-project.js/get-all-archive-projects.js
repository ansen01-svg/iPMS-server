import ArchiveProject from "../../models/archive-project.model.js";

const getAllArchiveProjects = async (req, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 5, 10); // Max 10 items per page
    const skip = (page - 1) * limit;

    // Search parameter
    const search = req.query.search?.trim();

    // Sorting parameters
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    // Build filter object
    const filter = {};

    // Financial Year filter
    if (req.query.financialYear) {
      if (Array.isArray(req.query.financialYear)) {
        filter.financialYear = { $in: req.query.financialYear };
      } else {
        filter.financialYear = req.query.financialYear;
      }
    }

    // Concerned Engineer filter
    if (req.query.concernedEngineer) {
      if (Array.isArray(req.query.concernedEngineer)) {
        filter.concernedEngineer = { $in: req.query.concernedEngineer };
      } else {
        filter.concernedEngineer = req.query.concernedEngineer;
      }
    }

    // Contractor filter
    if (req.query.nameOfContractor) {
      if (Array.isArray(req.query.nameOfContractor)) {
        filter.nameOfContractor = { $in: req.query.nameOfContractor };
      } else {
        // Partial match for contractor names
        filter.nameOfContractor = new RegExp(req.query.nameOfContractor, "i");
      }
    }

    // Location filter
    if (req.query.location) {
      if (Array.isArray(req.query.location)) {
        filter.location = { $in: req.query.location };
      } else {
        filter.location = new RegExp(req.query.location, "i");
      }
    }

    // Work Value range filter
    if (req.query.minWorkValue || req.query.maxWorkValue) {
      filter.workValue = {};
      if (req.query.minWorkValue) {
        filter.workValue.$gte = parseFloat(req.query.minWorkValue);
      }
      if (req.query.maxWorkValue) {
        filter.workValue.$lte = parseFloat(req.query.maxWorkValue);
      }
    }

    // AA Amount range filter
    if (req.query.minAAAmount || req.query.maxAAAmount) {
      filter.AAAmount = {};
      if (req.query.minAAAmount) {
        filter.AAAmount.$gte = parseFloat(req.query.minAAAmount);
      }
      if (req.query.maxAAAmount) {
        filter.AAAmount.$lte = parseFloat(req.query.maxAAAmount);
      }
    }

    // Progress range filter
    if (
      req.query.minProgress !== undefined ||
      req.query.maxProgress !== undefined
    ) {
      filter.progress = {};
      if (req.query.minProgress !== undefined) {
        filter.progress.$gte = parseFloat(req.query.minProgress);
      }
      if (req.query.maxProgress !== undefined) {
        filter.progress.$lte = parseFloat(req.query.maxProgress);
      }
    }

    // Progress status filter (using virtual field logic)
    if (req.query.progressStatus) {
      const statusMapping = {
        "Not Started": { progress: { $eq: 0 } },
        "Just Started": { progress: { $gt: 0, $lt: 25 } },
        "In Progress": { progress: { $gte: 25, $lt: 50 } },
        "Halfway Complete": { progress: { $gte: 50, $lt: 75 } },
        "Near Completion": { progress: { $gte: 75, $lt: 100 } },
        Completed: { progress: { $eq: 100 } },
      };

      if (Array.isArray(req.query.progressStatus)) {
        const statusFilters = req.query.progressStatus
          .filter((status) => statusMapping[status])
          .map((status) => statusMapping[status]);
        if (statusFilters.length > 0) {
          filter.$or = statusFilters;
        }
      } else if (statusMapping[req.query.progressStatus]) {
        Object.assign(filter, statusMapping[req.query.progressStatus]);
      }
    }

    // Date range filters
    if (req.query.startAADate || req.query.endAADate) {
      filter.AADated = {};
      if (req.query.startAADate) {
        filter.AADated.$gte = new Date(req.query.startAADate);
      }
      if (req.query.endAADate) {
        filter.AADated.$lte = new Date(req.query.endAADate);
      }
    }

    if (req.query.startFWODate || req.query.endFWODate) {
      filter.FWODate = {};
      if (req.query.startFWODate) {
        filter.FWODate.$gte = new Date(req.query.startFWODate);
      }
      if (req.query.endFWODate) {
        filter.FWODate.$lte = new Date(req.query.endFWODate);
      }
    }

    // Created date range filter
    if (req.query.startCreatedDate || req.query.endCreatedDate) {
      filter.createdAt = {};
      if (req.query.startCreatedDate) {
        filter.createdAt.$gte = new Date(req.query.startCreatedDate);
      }
      if (req.query.endCreatedDate) {
        filter.createdAt.$lte = new Date(req.query.endCreatedDate);
      }
    }

    // Bill Number filter (exact match)
    if (req.query.billNumber) {
      filter.billNumber = req.query.billNumber;
    }

    // AA Number filter (exact match)
    if (req.query.AANumber) {
      filter.AANumber = req.query.AANumber;
    }

    // Build the query
    let query = ArchiveProject.find();

    // Apply text search if provided
    if (search) {
      query = query.find({ $text: { $search: search } });
      // Add text search score for sorting
      query = query.select({ score: { $meta: "textScore" } });
      sort.score = { $meta: "textScore" };
    }

    // Apply filters
    query = query.find(filter);

    // Get total count for pagination (before applying skip/limit)
    const totalQuery = search
      ? ArchiveProject.find({ $text: { $search: search } }).find(filter)
      : ArchiveProject.find(filter);

    const totalDocuments = await totalQuery.countDocuments();

    // Apply sorting, pagination
    const projects = await query.sort(sort).skip(skip).limit(limit).lean(); // Use lean() for better performance

    // Calculate virtual fields for each project
    const projectsWithVirtuals = projects.map((project) => {
      // Calculate remaining work value
      const remainingWorkValue =
        project.billSubmittedAmount && project.workValue
          ? project.workValue - project.billSubmittedAmount
          : project.workValue;

      // Calculate progress status
      let progressStatus = "Not Started";
      if (project.progress) {
        if (project.progress < 25) progressStatus = "Just Started";
        else if (project.progress < 50) progressStatus = "In Progress";
        else if (project.progress < 75) progressStatus = "Halfway Complete";
        else if (project.progress < 100) progressStatus = "Near Completion";
        else progressStatus = "Completed";
      }

      // Calculate financial progress
      const financialProgress =
        project.billSubmittedAmount && project.workValue
          ? Math.round((project.billSubmittedAmount / project.workValue) * 100)
          : 0;

      return {
        ...project,
        remainingWorkValue,
        progressStatus,
        financialProgress,
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalDocuments / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // Generate summary statistics
    const statsQuery = search
      ? ArchiveProject.find({ $text: { $search: search } }).find(filter)
      : ArchiveProject.find(filter);

    // const stats = await statsQuery.aggregate([
    //   {
    //     $group: {
    //       _id: null,
    //       totalProjects: { $sum: 1 },
    //       totalWorkValue: { $sum: "$workValue" },
    //       totalAAAmount: { $sum: "$AAAmount" },
    //       totalBillSubmitted: { $sum: "$billSubmittedAmount" },
    //       avgProgress: { $avg: "$progress" },
    //       completedProjects: {
    //         $sum: { $cond: [{ $eq: ["$progress", 100] }, 1, 0] },
    //       },
    //       inProgressProjects: {
    //         $sum: {
    //           $cond: [
    //             {
    //               $and: [
    //                 { $gt: ["$progress", 0] },
    //                 { $lt: ["$progress", 100] },
    //               ],
    //             },
    //             1,
    //             0,
    //           ],
    //         },
    //       },
    //       notStartedProjects: {
    //         $sum: { $cond: [{ $eq: ["$progress", 0] }, 1, 0] },
    //       },
    //     },
    //   },
    // ]);

    const summary = {
      totalProjects: 0,
      totalWorkValue: 0,
      totalAAAmount: 0,
      totalBillSubmitted: 0,
      avgProgress: 0,
      completedProjects: 0,
      inProgressProjects: 0,
      notStartedProjects: 0,
    };

    // Response
    res.status(200).json({
      success: true,
      message: "Archive projects retrieved successfully",
      data: projectsWithVirtuals,
      pagination: {
        currentPage: page,
        totalPages,
        totalDocuments,
        hasNextPage,
        hasPrevPage,
        limit,
        skip,
      },
      summary: {
        ...summary,
        avgProgress: Math.round(summary.avgProgress * 100) / 100, // Round to 2 decimal places
        totalRemainingValue:
          summary.totalWorkValue - summary.totalBillSubmitted,
        completionRate:
          summary.totalProjects > 0
            ? Math.round(
                (summary.completedProjects / summary.totalProjects) * 100
              )
            : 0,
      },
      filters: {
        applied: Object.keys(filter).length > 0,
        search: search || null,
        sortBy,
        sortOrder: sortOrder === 1 ? "asc" : "desc",
      },
    });
  } catch (error) {
    console.error("Error retrieving archive projects:", error);

    // Handle specific errors
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid filter parameter format",
        details: {
          field: error.path,
          value: error.value,
          expectedType: error.kind,
        },
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving archive projects",
      error:
        process.env.NODE_ENV === "development"
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    });
  }
};

export default getAllArchiveProjects;
