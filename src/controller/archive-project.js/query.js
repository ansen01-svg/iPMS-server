import mongoose from "mongoose";
import ArchiveProject from "../../models/archive-project.model.js";

/**
 * Create a new query for an archive project
 * POST /api/archive-projects/:id/queries
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
    const project = await ArchiveProject.findById(id).session(session);
    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    // Generate unique queryId
    const existingQueries = await ArchiveProject.aggregate([
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
      `Query created successfully: ${queryId} for archive project ${id} by user: ${user.id}`
    );

    // Success response
    res.status(201).json({
      success: true,
      message: "Query created successfully",
      data: {
        query: createdQuery,
        projectInfo: {
          projectId: project._id,
          nameOfWork: project.nameOfWork,
          concernedEngineer: project.concernedEngineer,
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
          message: "Archive project not found",
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
 * Get queries for an archive project with filtering and pagination
 * GET /api/archive-projects/:id/queries
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

    const project = await ArchiveProject.findById(id);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Archive project not found",
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
      message: "Archive project queries retrieved successfully",
      data: {
        projectInfo: {
          projectId: project.projectId,
          nameOfWork: project.nameOfWork,
          concernedEngineer: project.concernedEngineer,
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
    console.error("Error retrieving archive project queries:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving queries",
    });
  }
};

/**
 * Get a single query by queryId
 * GET /api/archive-project/queries/:queryId
 */
export const getQueryById = async (req, res) => {
  try {
    const { queryId } = req.params;

    // Find project containing the query
    const project = await ArchiveProject.findOne({
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
          nameOfWork: project.nameOfWork,
          concernedEngineer: project.concernedEngineer,
          location: project.location,
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
 * Update a query with file upload support
 * PUT /api/archive-project/queries/:queryId
 */
export const updateQuery = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const { queryId } = req.params;
    // Only destructure the fields that are actually sent from frontend
    const { status, queryResponse } = req.body;
    const user = req.user;
    const uploadedFiles = req.queryFiles || []; // Files from middleware

    // Check user authorization
    if (!user || user.designation !== "JE") {
      throw new Error("UNAUTHORIZED_USER");
    }

    // Find project containing the query
    const project = await ArchiveProject.findOne({
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
    const previousAttachmentCount = query.attachments
      ? query.attachments.length
      : 0;

    // Handle file attachments
    if (uploadedFiles && uploadedFiles.length > 0) {
      const attachmentsToAdd = uploadedFiles.map((file) => ({
        fileName: file.fileName,
        originalName: file.originalName,
        downloadURL: file.downloadURL,
        filePath: file.filePath,
        fileSize: file.fileSize,
        mimeType: file.mimeType,
        fileType: file.fileType,
        uploadedAt: new Date(),
        uploadedBy: {
          userId: user.id,
          userName: user.name || user.username,
          userDesignation: user.designation,
        },
      }));

      // Initialize attachments array if it doesn't exist
      if (!query.attachments) {
        query.attachments = [];
      }

      // Add new attachments
      query.attachments.push(...attachmentsToAdd);

      console.log(
        `Added ${attachmentsToAdd.length} file attachments to archive query ${queryId}`
      );
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
    }

    // Handle query response
    if (queryResponse !== undefined && queryResponse.trim() !== "") {
      query.queryResponse = queryResponse.trim();
      // Auto-resolve when response is added
      if (query.status === "Open" || query.status === "In Progress") {
        query.status = "Resolved";
        query.actualResolutionDate = new Date();
      }
    }

    // Mark the queries array as modified to avoid circular reference issues
    project.markModified("queries");

    // Save the project
    await project.save({ session });

    // Commit transaction
    await session.commitTransaction();

    // Log successful update
    console.log(
      `Archive query updated successfully: ${queryId} by user: ${user.id}`
    );

    // Prepare change summary
    const changes = {};
    if (status && status !== previousStatus) {
      changes.status = { from: previousStatus, to: status };
    }
    if (uploadedFiles && uploadedFiles.length > 0) {
      changes.attachments = {
        from: previousAttachmentCount,
        to: query.attachments.length,
        filesAdded: uploadedFiles.length,
      };
    }

    // Create a clean response object without circular references
    const cleanQuery = {
      _id: query._id,
      queryId: query.queryId,
      projectId: query.projectId,
      queryTitle: query.queryTitle,
      queryDescription: query.queryDescription,
      queryCategory: query.queryCategory,
      priority: query.priority,
      status: query.status,
      raisedBy: query.raisedBy,
      assignedTo: query.assignedTo,
      raisedDate: query.raisedDate,
      expectedResolutionDate: query.expectedResolutionDate,
      actualResolutionDate: query.actualResolutionDate,
      queryResponse: query.queryResponse,
      internalRemarks: query.internalRemarks,
      escalationLevel: query.escalationLevel,
      attachments: query.attachments,
      isActive: query.isActive,
      createdAt: query.createdAt,
      updatedAt: query.updatedAt,
    };

    // Enhanced response with file information
    const responseData = {
      query: cleanQuery,
      changes,
      projectInfo: {
        projectId: project.projectId,
        nameOfWork: project.nameOfWork,
      },
    };

    // Add file upload summary if files were uploaded
    if (uploadedFiles && uploadedFiles.length > 0) {
      responseData.fileUploadSummary = {
        totalFilesUploaded: uploadedFiles.length,
        totalAttachments: query.attachments.length,
        uploadedFiles: uploadedFiles.map((file) => ({
          fileName: file.fileName,
          originalName: file.originalName,
          fileSize: file.fileSize,
          fileType: file.fileType,
        })),
      };
    }

    // Success response
    res.status(200).json({
      success: true,
      message: "Archive query updated successfully",
      data: responseData,
      metadata: {
        updatedAt: new Date().toISOString(),
        updatedBy: {
          userId: user.id,
          userName: user.name || user.username,
          userDesignation: user.designation,
        },
        filesProcessed: uploadedFiles ? uploadedFiles.length : 0,
      },
    });
  } catch (error) {
    // Ensure transaction is only aborted once
    if (session.inTransaction()) {
      await session.abortTransaction();
    }

    console.error("Error updating archive query:", error);

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
      message: "Internal server error occurred while updating archive query",
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
    // Ensure session is properly ended
    if (session) {
      await session.endSession();
    }
  }
};

/**
 * Delete (soft delete) a query
 * DELETE /api/archive-project/queries/:queryId
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
    const project = await ArchiveProject.findOne({
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
      `Archive query soft deleted successfully: ${queryId} by user: ${user.id}`
    );

    res.status(200).json({
      success: true,
      message: "Archive query deleted successfully",
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
    console.error("Error deleting archive query:", error);

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
      message: "Internal server error occurred while deleting archive query",
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
 * PUT /api/archive-project/queries/:queryId/escalate
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
    const project = await ArchiveProject.findOne({
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
      `Archive query escalated successfully: ${queryId} (Level ${previousEscalationLevel} -> ${query.escalationLevel}) by user: ${user.id}`
    );

    res.status(200).json({
      success: true,
      message: `Archive query escalated to level ${query.escalationLevel}`,
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
    console.error("Error escalating archive query:", error);

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
      message: "Internal server error occurred while escalating archive query",
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
 * Get query statistics across archive projects
 * GET /api/archive-project/queries/statistics
 */
export const getQueryStatistics = async (req, res) => {
  try {
    const {
      financialYear,
      concernedEngineer,
      startDate,
      endDate,
      status,
      priority,
      category,
    } = req.query;

    // Build match filter for projects
    const projectFilter = {};
    if (financialYear) projectFilter.financialYear = financialYear;
    if (concernedEngineer) projectFilter.concernedEngineer = concernedEngineer;

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
    const statistics = await ArchiveProject.aggregate([
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
      message: "Archive query statistics retrieved successfully",
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
          financialYear: financialYear || null,
          concernedEngineer: concernedEngineer || null,
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
    console.error("Error retrieving archive query statistics:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving archive query statistics",
    });
  }
};

/**
 * Search queries across all archive projects
 * GET /api/archive-project/queries/search
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
      financialYear,
      concernedEngineer,
    } = req.query;

    if (!searchTerm || searchTerm.trim().length < 3) {
      return res.status(400).json({
        success: false,
        message: "Search term must be at least 3 characters long",
      });
    }

    // Build filters
    const projectFilter = {};
    if (financialYear) projectFilter.financialYear = financialYear;
    if (concernedEngineer) projectFilter.concernedEngineer = concernedEngineer;

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

    const results = await ArchiveProject.aggregate([
      { $match: finalFilter },
      { $unwind: "$queries" },
      { $match: { "queries.isActive": true, ...textSearchFilter } },
      {
        $project: {
          query: "$queries",
          projectInfo: {
            projectId: "$projectId",
            nameOfWork: "$nameOfWork",
            concernedEngineer: "$concernedEngineer",
            location: "$location",
            financialYear: "$financialYear",
          },
        },
      },
      { $sort: { "query.raisedDate": -1 } },
      { $skip: skip },
      { $limit: limitNum },
    ]);

    // Get total count for pagination
    const totalResults = await ArchiveProject.aggregate([
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
      message: `Found ${total} archive queries matching "${searchTerm}"`,
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
          financialYear: financialYear || null,
          concernedEngineer: concernedEngineer || null,
        },
      },
    });
  } catch (error) {
    console.error("Error searching archive queries:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while searching archive queries",
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
