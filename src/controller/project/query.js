import mongoose from "mongoose";
import Project from "../../models/project.model.js";

/**
 * Create a new query for a project
 * POST /api/projects/:id/queries
 */
export const createQuery = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { id } = req.params;
    const {
      queryTitle,
      queryDescription,
      queryCategory,
      priority = "Medium",
      expectedResolutionDate,
      assignedTo,
    } = req.body;
    const user = req.user;

    // Validation
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("INVALID_PROJECT_ID");
    }

    if (
      !queryTitle ||
      !queryDescription ||
      !queryCategory ||
      !expectedResolutionDate
    ) {
      throw new Error("REQUIRED_FIELDS_MISSING");
    }

    // Check user authorization
    if (!user) {
      throw new Error("UNAUTHORIZED_USER");
    }

    // Find the project
    const project = await Project.findById(id).session(session);
    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    // Generate unique queryId
    const existingQueries = await Project.aggregate([
      { $unwind: "$queries" },
      { $group: { _id: null, count: { $sum: 1 } } },
    ]);
    const queryCount = existingQueries[0]?.count || 0;
    const year = new Date().getFullYear();
    const queryId = `QRY-${year}-${String(queryCount + 1).padStart(4, "0")}`;

    // Validate expected resolution date
    const expectedDate = new Date(expectedResolutionDate);
    if (expectedDate <= new Date()) {
      throw new Error("INVALID_EXPECTED_DATE");
    }

    // Create query object
    const newQuery = {
      queryId,
      projectId: project._id,
      queryTitle: queryTitle.trim(),
      queryDescription: queryDescription.trim(),
      queryCategory,
      priority,
      status: "Open",
      raisedBy: user.name || user.username,
      assignedTo: assignedTo?.trim() || "",
      raisedDate: new Date(),
      expectedResolutionDate: expectedDate,
      escalationLevel: 0,
      isActive: true,
    };

    // Add query to project
    project.queries.push(newQuery);

    await project.save({ session });

    // Get the newly created query
    const createdQuery = project.queries[project.queries.length - 1];

    // Commit transaction
    await session.commitTransaction();

    // Log successful creation
    console.log(
      `Query created successfully: ${queryId} for project ${id} by user: ${user.id}`
    );

    // Success response
    res.status(201).json({
      success: true,
      message: "Query created successfully",
      data: {
        query: createdQuery,
        projectInfo: {
          projectId: project._id,
          projectName: project.projectName,
          createdBy: project.createdBy,
        },
      },
      metadata: {
        createdAt: new Date().toISOString(),
        createdBy: {
          userId: user.id,
          userName: user.name || user.username,
          userDesignation: user.designation,
        },
        totalQueriesForProject: project.queries.length,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating query:", error);

    // Handle specific errors
    const errorHandlers = {
      INVALID_PROJECT_ID: () =>
        res.status(400).json({
          success: false,
          message: "Invalid project ID format",
          details: {
            providedId: req.params.id,
            expectedFormat: "MongoDB ObjectId",
          },
        }),

      REQUIRED_FIELDS_MISSING: () =>
        res.status(400).json({
          success: false,
          message: "Required fields are missing",
          details: {
            requiredFields: [
              "queryTitle",
              "queryDescription",
              "queryCategory",
              "expectedResolutionDate",
            ],
            providedFields: Object.keys(req.body),
          },
        }),

      UNAUTHORIZED_USER: () =>
        res.status(403).json({
          success: false,
          message:
            "Unauthorized. Only Junior Engineers (JE) can create queries",
          details: {
            requiredRole: "JE",
            currentRole: req.user?.designation || "Unknown",
          },
        }),

      PROJECT_NOT_FOUND: () =>
        res.status(404).json({
          success: false,
          message: "Project not found",
          details: { searchedId: req.params.id },
        }),

      INVALID_EXPECTED_DATE: () =>
        res.status(400).json({
          success: false,
          message: "Expected resolution date must be in the future",
          details: {
            providedDate: req.body.expectedResolutionDate,
            currentDate: new Date().toISOString(),
          },
        }),
    };

    const errorHandler = errorHandlers[error.message];
    if (errorHandler) {
      return errorHandler();
    }

    // Handle mongoose validation errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map((err) => ({
        field: err.path,
        message: err.message,
        value: err.value,
      }));

      return res.status(400).json({
        success: false,
        message: "Validation error occurred",
        errors: validationErrors,
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while creating query",
      error:
        process.env.NODE_ENV === "development"
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    });
  } finally {
    session.endSession();
  }
};

/**
 * Get queries for a project with filtering and pagination
 * GET /api/projects/:id/queries
 */
export const getProjectQueries = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 10,
      status,
      priority,
      category,
      assignedTo,
      raisedBy,
      overdue,
      search,
    } = req.query;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    let queries = project.queries.filter((q) => q.isActive);

    // Apply filters
    if (status) {
      queries = queries.filter((q) => q.status === status);
    }
    if (priority) {
      queries = queries.filter((q) => q.priority === priority);
    }
    if (category) {
      queries = queries.filter((q) => q.queryCategory === category);
    }
    if (assignedTo) {
      queries = queries.filter((q) =>
        q.assignedTo?.toLowerCase().includes(assignedTo.toLowerCase())
      );
    }
    if (raisedBy) {
      queries = queries.filter((q) =>
        q.raisedBy?.toLowerCase().includes(raisedBy.toLowerCase())
      );
    }
    if (overdue === "true") {
      const now = new Date();
      queries = queries.filter(
        (q) =>
          q.expectedResolutionDate < now &&
          !["Resolved", "Closed"].includes(q.status)
      );
    }
    if (search) {
      const searchLower = search.toLowerCase();
      queries = queries.filter(
        (q) =>
          q.queryTitle?.toLowerCase().includes(searchLower) ||
          q.queryDescription?.toLowerCase().includes(searchLower) ||
          q.queryResponse?.toLowerCase().includes(searchLower)
      );
    }

    // Sort by creation date (newest first)
    queries.sort((a, b) => new Date(b.raisedDate) - new Date(a.raisedDate));

    // Pagination
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);
    const skip = (pageNum - 1) * limitNum;
    const paginatedQueries = queries.slice(skip, skip + limitNum);

    // Add virtual fields to queries
    const enrichedQueries = paginatedQueries.map((query) => ({
      ...query.toObject(),
      daysSinceRaised: Math.ceil(
        (new Date() - query.raisedDate) / (1000 * 60 * 60 * 24)
      ),
      daysUntilDue: query.expectedResolutionDate
        ? Math.ceil(
            (query.expectedResolutionDate - new Date()) / (1000 * 60 * 60 * 24)
          )
        : null,
      isOverdue:
        query.expectedResolutionDate < new Date() &&
        !["Resolved", "Closed"].includes(query.status),
    }));

    // Calculate statistics
    const totalQueries = queries.length;
    const queryStats = {
      total: totalQueries,
      byStatus: queries.reduce((acc, q) => {
        acc[q.status] = (acc[q.status] || 0) + 1;
        return acc;
      }, {}),
      byPriority: queries.reduce((acc, q) => {
        acc[q.priority] = (acc[q.priority] || 0) + 1;
        return acc;
      }, {}),
      overdue: queries.filter(
        (q) =>
          q.expectedResolutionDate < new Date() &&
          !["Resolved", "Closed"].includes(q.status)
      ).length,
      avgEscalationLevel:
        totalQueries > 0
          ? queries.reduce((sum, q) => sum + q.escalationLevel, 0) /
            totalQueries
          : 0,
    };

    res.status(200).json({
      success: true,
      message: "Project queries retrieved successfully",
      data: {
        projectInfo: {
          projectId: project.projectId,
          projectName: project.projectName,
          createdBy: project.createdBy,
        },
        queries: enrichedQueries,
        statistics: queryStats,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalQueries / limitNum),
          totalItems: totalQueries,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < Math.ceil(totalQueries / limitNum),
          hasPrevPage: pageNum > 1,
        },
        filters: {
          status: status || null,
          priority: priority || null,
          category: category || null,
          assignedTo: assignedTo || null,
          raisedBy: raisedBy || null,
          overdue: overdue || null,
          search: search || null,
        },
      },
    });
  } catch (error) {
    console.error("Error retrieving project queries:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving queries",
    });
  }
};

/**
 * Get a single query by queryId
 * GET /api/projects/queries/:queryId
 */
export const getQueryById = async (req, res) => {
  try {
    const { queryId } = req.params;

    // Find project containing the query
    const project = await Project.findOne({
      "queries.queryId": queryId,
      "queries.isActive": true,
    });

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Query not found",
        details: { queryId },
      });
    }

    const query = project.queries.find(
      (q) => q.queryId === queryId && q.isActive
    );

    if (!query) {
      return res.status(404).json({
        success: false,
        message: "Query not found or inactive",
        details: { queryId },
      });
    }

    // Enrich query with virtual fields
    const enrichedQuery = {
      ...query.toObject(),
      daysSinceRaised: Math.ceil(
        (new Date() - query.raisedDate) / (1000 * 60 * 60 * 24)
      ),
      daysUntilDue: query.expectedResolutionDate
        ? Math.ceil(
            (query.expectedResolutionDate - new Date()) / (1000 * 60 * 60 * 24)
          )
        : null,
      isOverdue:
        query.expectedResolutionDate < new Date() &&
        !["Resolved", "Closed"].includes(query.status),
      resolutionTimeInDays:
        query.actualResolutionDate && query.raisedDate
          ? Math.ceil(
              (query.actualResolutionDate - query.raisedDate) /
                (1000 * 60 * 60 * 24)
            )
          : null,
    };

    res.status(200).json({
      success: true,
      message: "Query retrieved successfully",
      data: {
        query: enrichedQuery,
        projectInfo: {
          projectId: project.projectId,
          projectName: project.projectName,
          district: project.district,
          status: project.status,
        },
      },
    });
  } catch (error) {
    console.error("Error retrieving query:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving query",
    });
  }
};

/**
 * Update a query
 * PUT /api/projects/queries/:queryId
 */
export const updateQuery = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { queryId } = req.params;
    const {
      queryTitle,
      queryDescription,
      queryCategory,
      priority,
      status,
      assignedTo,
      expectedResolutionDate,
      queryResponse,
      internalRemarks,
    } = req.body;
    const user = req.user;

    // Check user authorization
    if (!user || user.designation !== "JE") {
      throw new Error("UNAUTHORIZED_USER");
    }

    // Find project containing the query
    const project = await Project.findOne({
      "queries.queryId": queryId,
      "queries.isActive": true,
    }).session(session);

    if (!project) {
      throw new Error("QUERY_NOT_FOUND");
    }

    const queryIndex = project.queries.findIndex(
      (q) => q.queryId === queryId && q.isActive
    );
    const query = project.queries[queryIndex];

    // Store previous values for response
    const previousStatus = query.status;
    const previousAssignedTo = query.assignedTo;

    // Update fields if provided
    if (queryTitle !== undefined) query.queryTitle = queryTitle.trim();
    if (queryDescription !== undefined)
      query.queryDescription = queryDescription.trim();
    if (queryCategory !== undefined) query.queryCategory = queryCategory;
    if (priority !== undefined) query.priority = priority;
    if (assignedTo !== undefined) query.assignedTo = assignedTo.trim();
    if (expectedResolutionDate !== undefined) {
      const expectedDate = new Date(expectedResolutionDate);
      if (expectedDate <= new Date()) {
        throw new Error("INVALID_EXPECTED_DATE");
      }
      query.expectedResolutionDate = expectedDate;
    }

    // Handle status updates
    if (status !== undefined && status !== query.status) {
      query.status = status;

      // Auto-set resolution date for resolved/closed queries
      if (
        ["Resolved", "Closed"].includes(status) &&
        !query.actualResolutionDate
      ) {
        query.actualResolutionDate = new Date();
      }

      // Set to In Progress if assigning to someone
      if (assignedTo && status === "Open") {
        query.status = "In Progress";
      }
    }

    // Handle query response
    if (queryResponse !== undefined) {
      query.queryResponse = queryResponse.trim();
      if (query.status === "Open" || query.status === "In Progress") {
        query.status = "Resolved";
        query.actualResolutionDate = new Date();
      }
    }

    // Handle internal remarks (append with timestamp)
    if (internalRemarks !== undefined && internalRemarks.trim()) {
      const timestamp = new Date().toISOString();
      const newRemark = `[${timestamp}] ${internalRemarks.trim()}`;
      query.internalRemarks = query.internalRemarks
        ? `${query.internalRemarks}\n${newRemark}`
        : newRemark;
    }

    // Save the project
    await project.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Log successful update
    console.log(`Query updated successfully: ${queryId} by user: ${user.id}`);

    // Prepare change summary
    const changes = {};
    if (status && status !== previousStatus)
      changes.status = { from: previousStatus, to: status };
    if (assignedTo && assignedTo !== previousAssignedTo)
      changes.assignedTo = { from: previousAssignedTo, to: assignedTo };

    // Success response
    res.status(200).json({
      success: true,
      message: "Query updated successfully",
      data: {
        query: project.queries[queryIndex],
        changes,
        projectInfo: {
          projectId: project.projectId,
          projectName: project.projectName,
        },
      },
      metadata: {
        updatedAt: new Date().toISOString(),
        updatedBy: {
          userId: user.id,
          userName: user.name || user.username,
          userDesignation: user.designation,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating query:", error);

    // Handle specific errors
    const errorHandlers = {
      UNAUTHORIZED_USER: () =>
        res.status(403).json({
          success: false,
          message:
            "Unauthorized. Only Junior Engineers (JE) can update queries",
          details: {
            requiredRole: "JE",
            currentRole: req.user?.designation || "Unknown",
          },
        }),

      QUERY_NOT_FOUND: () =>
        res.status(404).json({
          success: false,
          message: "Query not found",
          details: { queryId: req.params.queryId },
        }),

      INVALID_EXPECTED_DATE: () =>
        res.status(400).json({
          success: false,
          message: "Expected resolution date must be in the future",
          details: {
            providedDate: req.body.expectedResolutionDate,
            currentDate: new Date().toISOString(),
          },
        }),
    };

    const errorHandler = errorHandlers[error.message];
    if (errorHandler) {
      return errorHandler();
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while updating query",
      error:
        process.env.NODE_ENV === "development"
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    });
  } finally {
    session.endSession();
  }
};

/**
 * Delete (soft delete) a query
 * DELETE /api/projects/queries/:queryId
 */
export const deleteQuery = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { queryId } = req.params;
    const user = req.user;

    // Check user authorization
    if (!user || user.designation !== "JE") {
      throw new Error("UNAUTHORIZED_USER");
    }

    // Find project containing the query
    const project = await Project.findOne({
      "queries.queryId": queryId,
      "queries.isActive": true,
    }).session(session);

    if (!project) {
      throw new Error("QUERY_NOT_FOUND");
    }

    const query = project.queries.find(
      (q) => q.queryId === queryId && q.isActive
    );

    // Soft delete by setting isActive to false
    query.isActive = false;

    await project.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Log successful deletion
    console.log(
      `Query soft deleted successfully: ${queryId} by user: ${user.id}`
    );

    res.status(200).json({
      success: true,
      message: "Query deleted successfully",
      data: {
        queryId,
        deletedAt: new Date().toISOString(),
      },
      metadata: {
        deletedBy: {
          userId: user.id,
          userName: user.name || user.username,
          userDesignation: user.designation,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error deleting query:", error);

    // Handle specific errors
    const errorHandlers = {
      UNAUTHORIZED_USER: () =>
        res.status(403).json({
          success: false,
          message:
            "Unauthorized. Only Junior Engineers (JE) can delete queries",
          details: {
            requiredRole: "JE",
            currentRole: req.user?.designation || "Unknown",
          },
        }),

      QUERY_NOT_FOUND: () =>
        res.status(404).json({
          success: false,
          message: "Query not found",
          details: { queryId: req.params.queryId },
        }),
    };

    const errorHandler = errorHandlers[error.message];
    if (errorHandler) {
      return errorHandler();
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while deleting query",
      error:
        process.env.NODE_ENV === "development"
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    });
  } finally {
    session.endSession();
  }
};

/**
 * Escalate a query
 * PUT /api/projects/queries/:queryId/escalate
 */
export const escalateQuery = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { queryId } = req.params;
    const { reason = "" } = req.body;
    const user = req.user;

    // Check user authorization
    if (!user || user.designation !== "JE") {
      throw new Error("UNAUTHORIZED_USER");
    }

    // Find project containing the query
    const project = await Project.findOne({
      "queries.queryId": queryId,
      "queries.isActive": true,
    }).session(session);

    if (!project) {
      throw new Error("QUERY_NOT_FOUND");
    }

    const query = project.queries.find(
      (q) => q.queryId === queryId && q.isActive
    );

    // Check if already at max escalation level
    if (query.escalationLevel >= 5) {
      throw new Error("MAX_ESCALATION_REACHED");
    }

    // Check if query is already resolved/closed
    if (["Resolved", "Closed"].includes(query.status)) {
      throw new Error("CANNOT_ESCALATE_RESOLVED");
    }

    const previousEscalationLevel = query.escalationLevel;

    // Escalate the query
    query.escalationLevel += 1;
    query.status = "Escalated";

    // Add escalation note to internal remarks
    const timestamp = new Date().toISOString();
    const escalationNote = `[ESCALATED - Level ${query.escalationLevel}] ${
      reason || "No reason provided"
    }`;
    query.internalRemarks = query.internalRemarks
      ? `${query.internalRemarks}\n[${timestamp}] ${escalationNote}`
      : `[${timestamp}] ${escalationNote}`;

    await project.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Log successful escalation
    console.log(
      `Query escalated successfully: ${queryId} (Level ${previousEscalationLevel} -> ${query.escalationLevel}) by user: ${user.id}`
    );

    res.status(200).json({
      success: true,
      message: `Query escalated to level ${query.escalationLevel}`,
      data: {
        query: query,
        escalation: {
          from: previousEscalationLevel,
          to: query.escalationLevel,
          reason: reason || "No reason provided",
        },
      },
      metadata: {
        escalatedAt: new Date().toISOString(),
        escalatedBy: {
          userId: user.id,
          userName: user.name || user.username,
          userDesignation: user.designation,
        },
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error escalating query:", error);

    // Handle specific errors
    const errorHandlers = {
      UNAUTHORIZED_USER: () =>
        res.status(403).json({
          success: false,
          message:
            "Unauthorized. Only Junior Engineers (JE) can escalate queries",
          details: {
            requiredRole: "JE",
            currentRole: req.user?.designation || "Unknown",
          },
        }),

      QUERY_NOT_FOUND: () =>
        res.status(404).json({
          success: false,
          message: "Query not found",
          details: { queryId: req.params.queryId },
        }),

      MAX_ESCALATION_REACHED: () =>
        res.status(400).json({
          success: false,
          message: "Query has reached maximum escalation level",
          details: {
            maxLevel: 5,
            currentLevel: 5,
          },
        }),

      CANNOT_ESCALATE_RESOLVED: () =>
        res.status(400).json({
          success: false,
          message: "Cannot escalate resolved or closed queries",
          details: {
            currentStatus: req.query?.status,
            allowedStatuses: ["Open", "In Progress", "Under Review"],
          },
        }),
    };

    const errorHandler = errorHandlers[error.message];
    if (errorHandler) {
      return errorHandler();
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while escalating query",
      error:
        process.env.NODE_ENV === "development"
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    });
  } finally {
    session.endSession();
  }
};

/**
 * Get query statistics across projects
 * GET /api/projects/queries/statistics
 */
export const getQueryStatistics = async (req, res) => {
  try {
    const {
      fund,
      subFund,
      district,
      createdBy,
      startDate,
      endDate,
      status,
      priority,
      category,
    } = req.query;

    // Build match filter for projects
    const projectFilter = {};
    if (fund) projectFilter.fund = fund;
    if (subFund) projectFilter.subFund = subFund;
    if (district) projectFilter.district = district;
    if (createdBy) projectFilter["createdBy.userId"] = createdBy;

    // Build match filter for queries
    const queryFilter = { "queries.isActive": true };
    if (status) queryFilter["queries.status"] = status;
    if (priority) queryFilter["queries.priority"] = priority;
    if (category) queryFilter["queries.queryCategory"] = category;
    if (startDate || endDate) {
      queryFilter["queries.raisedDate"] = {};
      if (startDate)
        queryFilter["queries.raisedDate"].$gte = new Date(startDate);
      if (endDate) queryFilter["queries.raisedDate"].$lte = new Date(endDate);
    }

    // Combine filters
    const combinedFilter = { ...projectFilter, ...queryFilter };

    // Get comprehensive statistics
    const statistics = await Project.aggregate([
      { $match: combinedFilter },
      { $unwind: "$queries" },
      { $match: { "queries.isActive": true } },
      {
        $group: {
          _id: null,
          totalQueries: { $sum: 1 },
          totalProjects: { $addToSet: "$_id" },
          avgEscalationLevel: { $avg: "$queries.escalationLevel" },
          maxEscalationLevel: { $max: "$queries.escalationLevel" },

          // Status distribution
          openQueries: {
            $sum: { $cond: [{ $eq: ["$queries.status", "Open"] }, 1, 0] },
          },
          inProgressQueries: {
            $sum: {
              $cond: [{ $eq: ["$queries.status", "In Progress"] }, 1, 0],
            },
          },
          resolvedQueries: {
            $sum: { $cond: [{ $eq: ["$queries.status", "Resolved"] }, 1, 0] },
          },
          closedQueries: {
            $sum: { $cond: [{ $eq: ["$queries.status", "Closed"] }, 1, 0] },
          },
          escalatedQueries: {
            $sum: { $cond: [{ $eq: ["$queries.status", "Escalated"] }, 1, 0] },
          },

          // Priority distribution
          lowPriorityQueries: {
            $sum: { $cond: [{ $eq: ["$queries.priority", "Low"] }, 1, 0] },
          },
          mediumPriorityQueries: {
            $sum: { $cond: [{ $eq: ["$queries.priority", "Medium"] }, 1, 0] },
          },
          highPriorityQueries: {
            $sum: { $cond: [{ $eq: ["$queries.priority", "High"] }, 1, 0] },
          },
          urgentPriorityQueries: {
            $sum: { $cond: [{ $eq: ["$queries.priority", "Urgent"] }, 1, 0] },
          },

          // Category distribution
          technicalQueries: {
            $sum: {
              $cond: [{ $eq: ["$queries.queryCategory", "Technical"] }, 1, 0],
            },
          },
          financialQueries: {
            $sum: {
              $cond: [{ $eq: ["$queries.queryCategory", "Financial"] }, 1, 0],
            },
          },
          administrativeQueries: {
            $sum: {
              $cond: [
                { $eq: ["$queries.queryCategory", "Administrative"] },
                1,
                0,
              ],
            },
          },

          // Overdue calculations
          overdueQueries: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $lt: ["$queries.expectedResolutionDate", new Date()] },
                    {
                      $not: {
                        $in: ["$queries.status", ["Resolved", "Closed"]],
                      },
                    },
                  ],
                },
                1,
                0,
              ],
            },
          },

          // Resolution time for resolved queries
          resolvedQueriesWithTime: {
            $push: {
              $cond: [
                {
                  $and: [
                    { $in: ["$queries.status", ["Resolved", "Closed"]] },
                    { $ne: ["$queries.actualResolutionDate", null] },
                  ],
                },
                {
                  resolutionTime: {
                    $divide: [
                      {
                        $subtract: [
                          "$queries.actualResolutionDate",
                          "$queries.raisedDate",
                        ],
                      },
                      1000 * 60 * 60 * 24, // Convert to days
                    ],
                  },
                },
                null,
              ],
            },
          },
        },
      },
      {
        $project: {
          totalQueries: 1,
          totalProjects: { $size: "$totalProjects" },
          avgEscalationLevel: { $round: ["$avgEscalationLevel", 2] },
          maxEscalationLevel: 1,

          statusDistribution: {
            open: "$openQueries",
            inProgress: "$inProgressQueries",
            resolved: "$resolvedQueries",
            closed: "$closedQueries",
            escalated: "$escalatedQueries",
          },

          priorityDistribution: {
            low: "$lowPriorityQueries",
            medium: "$mediumPriorityQueries",
            high: "$highPriorityQueries",
            urgent: "$urgentPriorityQueries",
          },

          categoryDistribution: {
            technical: "$technicalQueries",
            financial: "$financialQueries",
            administrative: "$administrativeQueries",
          },

          overdueQueries: 1,
          overduePercentage: {
            $cond: [
              { $gt: ["$totalQueries", 0] },
              {
                $round: [
                  {
                    $multiply: [
                      { $divide: ["$overdueQueries", "$totalQueries"] },
                      100,
                    ],
                  },
                  2,
                ],
              },
              0,
            ],
          },

          resolutionStats: {
            resolvedCount: { $add: ["$resolvedQueries", "$closedQueries"] },
            resolutionRate: {
              $cond: [
                { $gt: ["$totalQueries", 0] },
                {
                  $round: [
                    {
                      $multiply: [
                        {
                          $divide: [
                            { $add: ["$resolvedQueries", "$closedQueries"] },
                            "$totalQueries",
                          ],
                        },
                        100,
                      ],
                    },
                    2,
                  ],
                },
                0,
              ],
            },
            avgResolutionTime: {
              $cond: [
                {
                  $gt: [
                    {
                      $size: {
                        $filter: {
                          input: "$resolvedQueriesWithTime",
                          cond: { $ne: ["$$this", null] },
                        },
                      },
                    },
                    0,
                  ],
                },
                {
                  $round: [
                    {
                      $avg: {
                        $map: {
                          input: {
                            $filter: {
                              input: "$resolvedQueriesWithTime",
                              cond: { $ne: ["$$this", null] },
                            },
                          },
                          as: "item",
                          in: "$$item.resolutionTime",
                        },
                      },
                    },
                    2,
                  ],
                },
                0,
              ],
            },
          },
        },
      },
    ]);

    const result = statistics[0] || {
      totalQueries: 0,
      totalProjects: 0,
      avgEscalationLevel: 0,
      maxEscalationLevel: 0,
      statusDistribution: {
        open: 0,
        inProgress: 0,
        resolved: 0,
        closed: 0,
        escalated: 0,
      },
      priorityDistribution: { low: 0, medium: 0, high: 0, urgent: 0 },
      categoryDistribution: { technical: 0, financial: 0, administrative: 0 },
      overdueQueries: 0,
      overduePercentage: 0,
      resolutionStats: {
        resolvedCount: 0,
        resolutionRate: 0,
        avgResolutionTime: 0,
      },
    };

    res.status(200).json({
      success: true,
      message: "Query statistics retrieved successfully",
      data: {
        overview: {
          totalQueries: result.totalQueries,
          totalProjects: result.totalProjects,
          overdueQueries: result.overdueQueries,
          overduePercentage: result.overduePercentage,
          avgEscalationLevel: result.avgEscalationLevel,
          maxEscalationLevel: result.maxEscalationLevel,
        },
        distributions: {
          status: result.statusDistribution,
          priority: result.priorityDistribution,
          category: result.categoryDistribution,
        },
        resolution: result.resolutionStats,
        filters: {
          fund: fund || null,
          subFund: subFund || null,
          district: district || null,
          createdBy: createdBy || null,
          startDate: startDate || null,
          endDate: endDate || null,
          status: status || null,
          priority: priority || null,
          category: category || null,
        },
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error retrieving query statistics:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving query statistics",
    });
  }
};

/**
 * Search queries across all projects
 * GET /api/projects/queries/search
 */
export const searchQueries = async (req, res) => {
  try {
    const {
      q: searchTerm,
      page = 1,
      limit = 10,
      status,
      priority,
      category,
      fund,
      subFund,
      district,
    } = req.query;

    if (!searchTerm || searchTerm.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Search term must be at least 3 characters long",
      });
    }

    // Build filters
    const projectFilter = {};
    if (fund) projectFilter.fund = fund;
    if (subFund) projectFilter.subFund = subFund;
    if (district) projectFilter.district = district;

    const queryFilter = { "queries.isActive": true };
    if (status) queryFilter["queries.status"] = status;
    if (priority) queryFilter["queries.priority"] = priority;
    if (category) queryFilter["queries.queryCategory"] = category;

    const combinedFilter = { ...projectFilter, ...queryFilter };

    // Search across query text fields
    const searchRegex = new RegExp(searchTerm.trim(), "i");
    const textSearchFilter = {
      $or: [
        { "queries.queryTitle": searchRegex },
        { "queries.queryDescription": searchRegex },
        { "queries.queryResponse": searchRegex },
        { "queries.internalRemarks": searchRegex },
      ],
    };

    const finalFilter = { ...combinedFilter, ...textSearchFilter };

    // Perform search with pagination
    const pageNum = parseInt(page);
    const limitNum = Math.min(parseInt(limit), 50);
    const skip = (pageNum - 1) * limitNum;

    const results = await Project.aggregate([
      { $match: finalFilter },
      { $unwind: "$queries" },
      { $match: { "queries.isActive": true, ...textSearchFilter } },
      {
        $project: {
          query: "$queries",
          projectInfo: {
            projectId: "$projectId",
            projectName: "$projectName",
            district: "$district",
            fund: "$fund",
            subFund: "$subFund",
          },
        },
      },
      { $sort: { "query.raisedDate": -1 } },
      { $skip: skip },
      { $limit: limitNum },
    ]);

    // Get total count for pagination
    const totalResults = await Project.aggregate([
      { $match: finalFilter },
      { $unwind: "$queries" },
      { $match: { "queries.isActive": true, ...textSearchFilter } },
      { $count: "total" },
    ]);

    const total = totalResults[0]?.total || 0;

    // Enrich results with virtual fields
    const enrichedResults = results.map((item) => ({
      ...item.query,
      projectInfo: item.projectInfo,
      daysSinceRaised: Math.ceil(
        (new Date() - item.query.raisedDate) / (1000 * 60 * 60 * 24)
      ),
      daysUntilDue: item.query.expectedResolutionDate
        ? Math.ceil(
            (item.query.expectedResolutionDate - new Date()) /
              (1000 * 60 * 60 * 24)
          )
        : null,
      isOverdue:
        item.query.expectedResolutionDate < new Date() &&
        !["Resolved", "Closed"].includes(item.query.status),
    }));

    res.status(200).json({
      success: true,
      message: `Found ${total} queries matching "${searchTerm}"`,
      data: {
        queries: enrichedResults,
        searchTerm: searchTerm.trim(),
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(total / limitNum),
          totalItems: total,
          itemsPerPage: limitNum,
          hasNextPage: pageNum < Math.ceil(total / limitNum),
          hasPrevPage: pageNum > 1,
        },
        filters: {
          status: status || null,
          priority: priority || null,
          category: category || null,
          fund: fund || null,
          subFund: subFund || null,
          district: district || null,
        },
      },
    });
  } catch (error) {
    console.error("Error searching queries:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while searching queries",
    });
  }
};

export default {
  createQuery,
  getProjectQueries,
  getQueryById,
  updateQuery,
  deleteQuery,
  escalateQuery,
  getQueryStatistics,
  searchQueries,
};
