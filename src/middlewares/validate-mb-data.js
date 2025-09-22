/**
 * Middleware to validate measurement book data before processing
 * Works with both single and batch uploads after file upload middleware
 */
export const validateMBData = (req, res, next) => {
  try {
    const { measurementBooks } = req.body;

    // Check if measurementBooks exists and is an array
    if (!measurementBooks) {
      return res.status(400).json({
        success: false,
        message: "measurementBooks field is required",
      });
    }

    if (!Array.isArray(measurementBooks)) {
      return res.status(400).json({
        success: false,
        message: "measurementBooks must be an array",
      });
    }

    if (measurementBooks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "measurementBooks array cannot be empty",
      });
    }

    // Validate array length (prevent too many items in one request)
    if (measurementBooks.length > 50) {
      return res.status(400).json({
        success: false,
        message: "Cannot create more than 50 measurement books in one request",
      });
    }

    const errors = [];

    // Validate each measurement book
    measurementBooks.forEach((mb, index) => {
      const mbNumber = index + 1;

      // Validate project ID (now expecting projectId string, not ObjectId)
      if (!mb.project) {
        errors.push(`MB ${mbNumber}: project field is required`);
      } else if (typeof mb.project !== "string") {
        errors.push(`MB ${mbNumber}: project must be a string (projectId)`);
      } else if (mb.project.trim().length === 0) {
        errors.push(`MB ${mbNumber}: project cannot be empty`);
      } else if (mb.project.trim().length > 50) {
        errors.push(`MB ${mbNumber}: project ID cannot exceed 50 characters`);
      }

      // Validate description
      if (!mb.description) {
        errors.push(`MB ${mbNumber}: description field is required`);
      } else if (typeof mb.description !== "string") {
        errors.push(`MB ${mbNumber}: description must be a string`);
      } else if (mb.description.trim().length < 10) {
        errors.push(
          `MB ${mbNumber}: description must be at least 10 characters`
        );
      } else if (mb.description.trim().length > 1000) {
        errors.push(
          `MB ${mbNumber}: description cannot exceed 1000 characters`
        );
      }

      // Validate remarks (optional)
      if (mb.remarks && typeof mb.remarks !== "string") {
        errors.push(`MB ${mbNumber}: remarks must be a string`);
      } else if (mb.remarks && mb.remarks.trim().length > 500) {
        errors.push(`MB ${mbNumber}: remarks cannot exceed 500 characters`);
      }

      // Validate uploaded file (should be set by file upload middleware)
      if (!mb.uploadedFile) {
        errors.push(
          `MB ${mbNumber}: uploadedFile field is required (file upload middleware should have set this)`
        );
      } else {
        const file = mb.uploadedFile;

        // Validate file properties set by middleware
        const requiredFileFields = [
          "fileName",
          "originalName",
          "downloadURL",
          "filePath",
          "fileSize",
          "mimeType",
          "fileType",
        ];

        requiredFileFields.forEach((field) => {
          if (!file[field]) {
            errors.push(`MB ${mbNumber}: uploadedFile.${field} is required`);
          }
        });

        // Validate file size
        if (
          file.fileSize &&
          (typeof file.fileSize !== "number" || file.fileSize <= 0)
        ) {
          errors.push(
            `MB ${mbNumber}: uploadedFile.fileSize must be a positive number`
          );
        }

        // Validate file type
        if (file.fileType && !["document", "image"].includes(file.fileType)) {
          errors.push(
            `MB ${mbNumber}: uploadedFile.fileType must be either 'document' or 'image'`
          );
        }

        // Validate file size limit (10MB)
        if (file.fileSize && file.fileSize > 10 * 1024 * 1024) {
          errors.push(`MB ${mbNumber}: file size cannot exceed 10MB`);
        }

        // Validate allowed MIME types
        const allowedMimeTypes = [
          "application/pdf",
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
        ];

        if (file.mimeType && !allowedMimeTypes.includes(file.mimeType)) {
          errors.push(
            `MB ${mbNumber}: invalid file type. Only PDF and image files are allowed`
          );
        }
      }
    });

    // If there are validation errors, return them
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed for measurement book data",
        errors,
        validMBs: measurementBooks.length - errors.length,
        totalMBs: measurementBooks.length,
      });
    }

    // If validation passes, continue to the next middleware/controller
    next();
  } catch (error) {
    console.error("Error in MB validation middleware:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during validation",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Middleware to sanitize measurement book data
 */
export const sanitizeMBData = (req, res, next) => {
  try {
    const { measurementBooks } = req.body;

    // Sanitize each measurement book
    const sanitizedMBs = measurementBooks.map((mb) => ({
      ...mb,
      project: mb.project?.toString().trim(),
      description: mb.description?.trim(),
      remarks: mb.remarks?.trim() || undefined,
      uploadedFile: mb.uploadedFile
        ? {
            ...mb.uploadedFile,
            fileName: mb.uploadedFile.fileName?.trim(),
            originalName: mb.uploadedFile.originalName?.trim(),
            downloadURL: mb.uploadedFile.downloadURL?.trim(),
            filePath: mb.uploadedFile.filePath?.trim(),
            mimeType: mb.uploadedFile.mimeType?.trim().toLowerCase(),
            fileType: mb.uploadedFile.fileType?.trim().toLowerCase(),
          }
        : mb.uploadedFile,
    }));

    req.body.measurementBooks = sanitizedMBs;
    next();
  } catch (error) {
    console.error("Error in MB sanitization middleware:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during sanitization",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Middleware to validate project IDs exist in database using projectId strings
 * This runs after basic validation but before actual creation
 */
export const validateProjectsExist = async (req, res, next) => {
  try {
    const { measurementBooks } = req.body;
    const { findMultipleProjectsByProjectId } = await import(
      "../utils/project-utils.js"
    );

    // Extract unique project IDs (projectId strings)
    const projectIds = [
      ...new Set(measurementBooks.map((mb) => mb.project.trim())),
    ];

    // Validate all project IDs at once
    const projectValidation = await findMultipleProjectsByProjectId(projectIds);

    const invalidProjects = projectValidation.filter((p) => !p.found);

    if (invalidProjects.length > 0) {
      const errors = invalidProjects.map(
        (p) =>
          `Project with ID '${p.projectId}' not found in either Project or ArchiveProject collections`
      );

      return res.status(404).json({
        success: false,
        message: "Some projects were not found",
        errors,
        invalidProjectIds: invalidProjects.map((p) => p.projectId),
        validProjectIds: projectValidation
          .filter((p) => p.found)
          .map((p) => p.projectId),
      });
    }

    // Attach project validation results to request for use in controller
    req.projectValidation = projectValidation;
    next();
  } catch (error) {
    console.error("Error validating projects exist:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during project validation",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Middleware to check user permissions for projects
 * Add this if you need project-level permissions
 */
export const validateProjectPermissions = async (req, res, next) => {
  try {
    const { measurementBooks } = req.body;
    const user = req.user;

    // Extract unique project IDs
    const projectIds = [...new Set(measurementBooks.map((mb) => mb.project))];

    // Here you would implement your permission logic
    // For example, check if user has permission to create MBs for these projects

    // Placeholder implementation - customize based on your permission system
    const unauthorizedProjects = [];

    // Example permission check (customize based on your system):
    /*
    for (const projectId of projectIds) {
      const hasPermission = await checkUserProjectPermission(user.userId, projectId, 'CREATE_MB');
      if (!hasPermission) {
        unauthorizedProjects.push(projectId);
      }
    }
    */

    if (unauthorizedProjects.length > 0) {
      return res.status(403).json({
        success: false,
        message: "Insufficient permissions for some projects",
        unauthorizedProjects,
        details:
          "You don't have permission to create measurement books for these projects",
      });
    }

    next();
  } catch (error) {
    console.error("Error validating project permissions:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during permission validation",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Complete validation pipeline for MB creation
 */
export const completeMBValidation = [
  validateMBData, // Basic data structure validation
  sanitizeMBData, // Clean and sanitize data
  validateProjectsExist, // Check projects exist in database
  // validateProjectPermissions, // Uncomment if you need permission checks
];

/**
 * Lightweight validation for update operations (no file validation)
 */
export const validateMBUpdateData = (req, res, next) => {
  try {
    const { description, remarks } = req.body;

    const errors = [];

    // Validate description if provided
    if (description !== undefined) {
      if (typeof description !== "string") {
        errors.push("description must be a string");
      } else if (description.trim().length < 10) {
        errors.push("description must be at least 10 characters");
      } else if (description.trim().length > 1000) {
        errors.push("description cannot exceed 1000 characters");
      }
    }

    // Validate remarks if provided
    if (remarks !== undefined && remarks !== null) {
      if (typeof remarks !== "string") {
        errors.push("remarks must be a string");
      } else if (remarks.trim().length > 500) {
        errors.push("remarks cannot exceed 500 characters");
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Sanitize data
    if (description !== undefined) {
      req.body.description = description.trim();
    }
    if (remarks !== undefined) {
      req.body.remarks = remarks ? remarks.trim() : remarks;
    }

    next();
  } catch (error) {
    console.error("Error in MB update validation middleware:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error during validation",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
