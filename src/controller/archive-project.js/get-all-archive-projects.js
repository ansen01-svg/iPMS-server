import ArchiveProject from "../../models/archive-project.model.js";

const getAllArchiveProjects = async (req, res) => {
  try {
    // Extract user information for role-based filtering
    const user = req.user;
    const userRole = user.designation;

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 5, 10);
    const skip = (page - 1) * limit;

    // Search parameter
    const search = req.query.search?.trim();

    // Sorting parameters
    const sortBy = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    // Build filter object (existing filters remain the same)
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

    // Progress range filter (physical progress)
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

    // NEW: Financial Progress range filter
    if (
      req.query.minFinancialProgress !== undefined ||
      req.query.maxFinancialProgress !== undefined
    ) {
      filter.financialProgress = {};
      if (req.query.minFinancialProgress !== undefined) {
        filter.financialProgress.$gte = parseFloat(
          req.query.minFinancialProgress
        );
      }
      if (req.query.maxFinancialProgress !== undefined) {
        filter.financialProgress.$lte = parseFloat(
          req.query.maxFinancialProgress
        );
      }
    }

    // Progress status filter (physical progress)
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
          filter.$or = filter.$or
            ? [...filter.$or, ...statusFilters]
            : statusFilters;
        }
      } else if (statusMapping[req.query.progressStatus]) {
        Object.assign(filter, statusMapping[req.query.progressStatus]);
      }
    }

    // NEW: Financial Progress status filter
    if (req.query.financialProgressStatus) {
      const statusMapping = {
        "Not Started": { financialProgress: { $eq: 0 } },
        "Just Started": { financialProgress: { $gt: 0, $lt: 25 } },
        "In Progress": { financialProgress: { $gte: 25, $lt: 50 } },
        "Halfway Complete": { financialProgress: { $gte: 50, $lt: 75 } },
        "Near Completion": { financialProgress: { $gte: 75, $lt: 100 } },
        Completed: { financialProgress: { $eq: 100 } },
      };

      if (Array.isArray(req.query.financialProgressStatus)) {
        const statusFilters = req.query.financialProgressStatus
          .filter((status) => statusMapping[status])
          .map((status) => statusMapping[status]);
        if (statusFilters.length > 0) {
          filter.$or = filter.$or
            ? [...filter.$or, ...statusFilters]
            : statusFilters;
        }
      } else if (statusMapping[req.query.financialProgressStatus]) {
        Object.assign(filter, statusMapping[req.query.financialProgressStatus]);
      }
    }

    // Date range filters (existing ones remain the same)
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

    if (req.query.startCreatedDate || req.query.endCreatedDate) {
      filter.createdAt = {};
      if (req.query.startCreatedDate) {
        filter.createdAt.$gte = new Date(req.query.startCreatedDate);
      }
      if (req.query.endCreatedDate) {
        filter.createdAt.$lte = new Date(req.query.endCreatedDate);
      }
    }

    // Bill Number and AA Number filters (existing)
    if (req.query.billNumber) {
      filter.billNumber = req.query.billNumber;
    }

    if (req.query.AANumber) {
      filter.AANumber = req.query.AANumber;
    }

    // Role-based filtering - Apply AFTER all query param filters
    switch (userRole) {
      case "JE":
        // JE can only see projects where they are the concerned engineer
        // This overrides any concernedEngineer filter from query params for security
        filter.concernedEngineer = {
          $in: [user.fullName, user.username].filter(Boolean),
        };
        break;

      case "AEE":
      case "CE":
      case "MD":
      case "VIEWER":
      case "ADMIN":
      case "OPERATOR":
        // These roles can see all archive projects (respecting other filters)
        break;

      default:
        return res.status(403).json({
          success: false,
          message: `Invalid user role: ${userRole}. Access denied.`,
        });
    }

    // Build the query
    let query = ArchiveProject.find();

    // Apply text search if provided
    if (search) {
      query = query.find({ $text: { $search: search } });
      query = query.select({ score: { $meta: "textScore" } });
      sort.score = { $meta: "textScore" };
    }

    // Apply filters
    query = query.find(filter);

    // Get total count for pagination
    const totalQuery = search
      ? ArchiveProject.find({ $text: { $search: search } }).find(filter)
      : ArchiveProject.find(filter);

    const totalDocuments = await totalQuery.countDocuments();

    // Apply sorting, pagination
    const projects = await query.sort(sort).skip(skip).limit(limit).lean();

    // UPDATED: Calculate virtual fields for each project including financial progress
    const projectsWithVirtuals = projects.map((project) => {
      // Calculate remaining work value
      const remainingWorkValue =
        project.billSubmittedAmount && project.workValue
          ? project.workValue - project.billSubmittedAmount
          : project.workValue;

      // Calculate progress status (physical)
      let progressStatus = "Not Started";
      if (project.progress) {
        if (project.progress < 25) progressStatus = "Just Started";
        else if (project.progress < 50) progressStatus = "In Progress";
        else if (project.progress < 75) progressStatus = "Halfway Complete";
        else if (project.progress < 100) progressStatus = "Near Completion";
        else progressStatus = "Completed";
      }

      // NEW: Calculate financial progress status
      let financialProgressStatus = "Not Started";
      if (project.financialProgress) {
        if (project.financialProgress < 25)
          financialProgressStatus = "Just Started";
        else if (project.financialProgress < 50)
          financialProgressStatus = "In Progress";
        else if (project.financialProgress < 75)
          financialProgressStatus = "Halfway Complete";
        else if (project.financialProgress < 100)
          financialProgressStatus = "Near Completion";
        else financialProgressStatus = "Completed";
      }

      // Calculate financial progress percentage (should match model calculation)
      const calculatedFinancialProgress =
        project.billSubmittedAmount && project.workValue
          ? Math.round((project.billSubmittedAmount / project.workValue) * 100)
          : 0;

      return {
        ...project,
        remainingWorkValue,
        progressStatus,
        financialProgressStatus, // NEW
        financialProgress:
          project.financialProgress || calculatedFinancialProgress, // NEW
        progressSummary: {
          // NEW: Combined progress summary
          physical: {
            percentage: project.progress || 0,
            status: progressStatus,
            lastUpdate: project.lastProgressUpdate,
          },
          financial: {
            percentage:
              project.financialProgress || calculatedFinancialProgress,
            status: financialProgressStatus,
            lastUpdate: project.lastFinancialProgressUpdate,
            amountSubmitted: project.billSubmittedAmount || 0,
            amountRemaining: remainingWorkValue,
          },
        },
      };
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalDocuments / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // UPDATED: Enhanced summary statistics with financial progress
    const summary = await ArchiveProject.aggregate([
      { $match: search ? { $text: { $search: search }, ...filter } : filter },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          totalWorkValue: { $sum: "$workValue" },
          totalAAAmount: { $sum: "$AAAmount" },
          totalBillSubmitted: { $sum: "$billSubmittedAmount" },
          avgProgress: { $avg: "$progress" },
          avgFinancialProgress: { $avg: "$financialProgress" }, // NEW
          completedProjects: {
            $sum: { $cond: [{ $eq: ["$progress", 100] }, 1, 0] },
          },
          financiallyCompletedProjects: {
            // NEW
            $sum: { $cond: [{ $eq: ["$financialProgress", 100] }, 1, 0] },
          },
          fullyCompletedProjects: {
            // NEW: Both physical and financial complete
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$progress", 100] },
                    { $eq: ["$financialProgress", 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          inProgressProjects: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$progress", 0] },
                    { $lt: ["$progress", 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          financiallyInProgressProjects: {
            // NEW
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$financialProgress", 0] },
                    { $lt: ["$financialProgress", 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          notStartedProjects: {
            $sum: { $cond: [{ $eq: ["$progress", 0] }, 1, 0] },
          },
          financiallyNotStartedProjects: {
            // NEW
            $sum: { $cond: [{ $eq: ["$financialProgress", 0] }, 1, 0] },
          },
        },
      },
    ]);

    const summaryData = summary[0] || {
      totalProjects: 0,
      totalWorkValue: 0,
      totalAAAmount: 0,
      totalBillSubmitted: 0,
      avgProgress: 0,
      avgFinancialProgress: 0,
      completedProjects: 0,
      financiallyCompletedProjects: 0,
      fullyCompletedProjects: 0,
      inProgressProjects: 0,
      financiallyInProgressProjects: 0,
      notStartedProjects: 0,
      financiallyNotStartedProjects: 0,
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
        ...summaryData,
        avgProgress: Math.round(summaryData.avgProgress * 100) / 100,
        avgFinancialProgress:
          Math.round(summaryData.avgFinancialProgress * 100) / 100, // NEW
        totalRemainingValue:
          summaryData.totalWorkValue - summaryData.totalBillSubmitted,
        completionRate:
          summaryData.totalProjects > 0
            ? Math.round(
                (summaryData.completedProjects / summaryData.totalProjects) *
                  100
              )
            : 0,
        financialCompletionRate:
          summaryData.totalProjects > 0 // NEW
            ? Math.round(
                (summaryData.financiallyCompletedProjects /
                  summaryData.totalProjects) *
                  100
              )
            : 0,
        fullCompletionRate:
          summaryData.totalProjects > 0 // NEW
            ? Math.round(
                (summaryData.fullyCompletedProjects /
                  summaryData.totalProjects) *
                  100
              )
            : 0,
        billSubmissionRate:
          summaryData.totalWorkValue > 0 // NEW
            ? Math.round(
                (summaryData.totalBillSubmitted / summaryData.totalWorkValue) *
                  100
              )
            : 0,
      },
      filters: {
        applied: Object.keys(filter).length > 0,
        search: search || null,
        sortBy,
        sortOrder: sortOrder === 1 ? "asc" : "desc",
      },
      userRole, // Include user role in response for debugging
    });
  } catch (error) {
    console.error("Error retrieving archive projects:", error);

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
