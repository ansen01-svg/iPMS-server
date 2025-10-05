/**
 * Middleware to validate measurement book data before processing
 * Works with both single and batch uploads after file upload middleware
 */
export const validateMBData = (req, res, next) => {
  try {
    const { measurementBooks } = req.body;

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

      // Validate project ID
      if (!mb.project) {
        errors.push(`MB ${mbNumber}: project field is required`);
      } else if (typeof mb.project !== "string") {
        errors.push(`MB ${mbNumber}: project must be a string (projectId)`);
      } else if (mb.project.trim().length === 0) {
        errors.push(`MB ${mbNumber}: project cannot be empty`);
      } else if (mb.project.trim().length > 50) {
        errors.push(`MB ${mbNumber}: project ID cannot exceed 50 characters`);
      }

      // Validate MB No
      if (!mb.mbNo) {
        errors.push(`MB ${mbNumber}: mbNo field is required`);
      } else if (typeof mb.mbNo !== "string") {
        errors.push(`MB ${mbNumber}: mbNo must be a string`);
      } else if (mb.mbNo.trim().length === 0) {
        errors.push(`MB ${mbNumber}: mbNo cannot be empty`);
      }

      // Validate Name of Work
      if (!mb.nameOfWork) {
        errors.push(`MB ${mbNumber}: nameOfWork field is required`);
      } else if (typeof mb.nameOfWork !== "string") {
        errors.push(`MB ${mbNumber}: nameOfWork must be a string`);
      } else if (mb.nameOfWork.trim().length < 5) {
        errors.push(`MB ${mbNumber}: nameOfWork must be at least 5 characters`);
      } else if (mb.nameOfWork.trim().length > 500) {
        errors.push(`MB ${mbNumber}: nameOfWork cannot exceed 500 characters`);
      }

      // Validate Location
      if (!mb.location) {
        errors.push(`MB ${mbNumber}: location field is required`);
      } else if (typeof mb.location !== "string") {
        errors.push(`MB ${mbNumber}: location must be a string`);
      } else if (mb.location.trim().length === 0) {
        errors.push(`MB ${mbNumber}: location cannot be empty`);
      } else if (mb.location.trim().length > 200) {
        errors.push(`MB ${mbNumber}: location cannot exceed 200 characters`);
      }

      // Validate Contractor
      if (!mb.contractor) {
        errors.push(`MB ${mbNumber}: contractor field is required`);
      } else if (typeof mb.contractor !== "string") {
        errors.push(`MB ${mbNumber}: contractor must be a string`);
      } else if (mb.contractor.trim().length === 0) {
        errors.push(`MB ${mbNumber}: contractor cannot be empty`);
      } else if (mb.contractor.trim().length > 200) {
        errors.push(`MB ${mbNumber}: contractor cannot exceed 200 characters`);
      }

      // Validate optional fields
      if (mb.tenderAgreement && mb.tenderAgreement.trim().length > 200) {
        errors.push(
          `MB ${mbNumber}: tenderAgreement cannot exceed 200 characters`
        );
      }

      if (mb.aaOrFsNo && mb.aaOrFsNo.trim().length > 100) {
        errors.push(`MB ${mbNumber}: aaOrFsNo cannot exceed 100 characters`);
      }

      if (mb.slNoOfBill && mb.slNoOfBill.trim().length > 50) {
        errors.push(`MB ${mbNumber}: slNoOfBill cannot exceed 50 characters`);
      }

      // Validate dates
      if (!mb.dateOfCommencement) {
        errors.push(`MB ${mbNumber}: dateOfCommencement is required`);
      } else if (isNaN(Date.parse(mb.dateOfCommencement))) {
        errors.push(`MB ${mbNumber}: dateOfCommencement must be a valid date`);
      }

      if (!mb.dateOfCompletion) {
        errors.push(`MB ${mbNumber}: dateOfCompletion is required`);
      } else if (isNaN(Date.parse(mb.dateOfCompletion))) {
        errors.push(`MB ${mbNumber}: dateOfCompletion must be a valid date`);
      }

      if (!mb.dateOfMeasurement) {
        errors.push(`MB ${mbNumber}: dateOfMeasurement is required`);
      } else if (isNaN(Date.parse(mb.dateOfMeasurement))) {
        errors.push(`MB ${mbNumber}: dateOfMeasurement must be a valid date`);
      }

      // Validate date logic
      if (
        mb.dateOfCommencement &&
        mb.dateOfCompletion &&
        new Date(mb.dateOfCommencement) > new Date(mb.dateOfCompletion)
      ) {
        errors.push(
          `MB ${mbNumber}: dateOfCommencement cannot be after dateOfCompletion`
        );
      }

      if (mb.aaOrFsDate && isNaN(Date.parse(mb.aaOrFsDate))) {
        errors.push(`MB ${mbNumber}: aaOrFsDate must be a valid date`);
      }

      // Validate measurements array
      if (!mb.measurements) {
        errors.push(`MB ${mbNumber}: measurements field is required`);
      } else if (!Array.isArray(mb.measurements)) {
        errors.push(`MB ${mbNumber}: measurements must be an array`);
      } else if (mb.measurements.length === 0) {
        errors.push(`MB ${mbNumber}: measurements array cannot be empty`);
      } else if (mb.measurements.length > 100) {
        errors.push(
          `MB ${mbNumber}: cannot have more than 100 measurement items`
        );
      } else {
        // Validate each measurement item
        mb.measurements.forEach((measurement, mIndex) => {
          const measurementNumber = mIndex + 1;

          if (!measurement.id) {
            errors.push(
              `MB ${mbNumber}, Measurement ${measurementNumber}: id is required`
            );
          }

          if (!measurement.description) {
            errors.push(
              `MB ${mbNumber}, Measurement ${measurementNumber}: description is required`
            );
          } else if (typeof measurement.description !== "string") {
            errors.push(
              `MB ${mbNumber}, Measurement ${measurementNumber}: description must be a string`
            );
          } else if (measurement.description.trim().length < 5) {
            errors.push(
              `MB ${mbNumber}, Measurement ${measurementNumber}: description must be at least 5 characters`
            );
          } else if (measurement.description.trim().length > 1000) {
            errors.push(
              `MB ${mbNumber}, Measurement ${measurementNumber}: description cannot exceed 1000 characters`
            );
          }

          if (!measurement.unit) {
            errors.push(
              `MB ${mbNumber}, Measurement ${measurementNumber}: unit is required`
            );
          } else if (typeof measurement.unit !== "string") {
            errors.push(
              `MB ${mbNumber}, Measurement ${measurementNumber}: unit must be a string`
            );
          } else if (measurement.unit.trim().length > 50) {
            errors.push(
              `MB ${mbNumber}, Measurement ${measurementNumber}: unit cannot exceed 50 characters`
            );
          }

          // Validate uploaded file
          if (!measurement.uploadedFile) {
            errors.push(
              `MB ${mbNumber}, Measurement ${measurementNumber}: uploadedFile is required`
            );
          } else {
            const file = measurement.uploadedFile;
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
                errors.push(
                  `MB ${mbNumber}, Measurement ${measurementNumber}: uploadedFile.${field} is required`
                );
              }
            });

            if (file.fileSize && file.fileSize > 10 * 1024 * 1024) {
              errors.push(
                `MB ${mbNumber}, Measurement ${measurementNumber}: file size cannot exceed 10MB`
              );
            }

            const allowedMimeTypes = [
              "application/pdf",
              "image/jpeg",
              "image/jpg",
              "image/png",
              "image/webp",
            ];

            if (file.mimeType && !allowedMimeTypes.includes(file.mimeType)) {
              errors.push(
                `MB ${mbNumber}, Measurement ${measurementNumber}: invalid file type`
              );
            }

            if (
              file.fileType &&
              !["document", "image"].includes(file.fileType)
            ) {
              errors.push(
                `MB ${mbNumber}, Measurement ${measurementNumber}: fileType must be 'document' or 'image'`
              );
            }
          }
        });
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

    const sanitizedMBs = measurementBooks.map((mb) => ({
      ...mb,
      project: mb.project?.toString().trim(),
      mbNo: mb.mbNo?.trim(),
      nameOfWork: mb.nameOfWork?.trim(),
      location: mb.location?.trim(),
      contractor: mb.contractor?.trim(),
      tenderAgreement: mb.tenderAgreement?.trim() || undefined,
      aaOrFsNo: mb.aaOrFsNo?.trim() || undefined,
      slNoOfBill: mb.slNoOfBill?.trim() || undefined,
      measurements: mb.measurements?.map((measurement) => ({
        ...measurement,
        description: measurement.description?.trim(),
        unit: measurement.unit?.trim(),
        uploadedFile: measurement.uploadedFile
          ? {
              ...measurement.uploadedFile,
              fileName: measurement.uploadedFile.fileName?.trim(),
              originalName: measurement.uploadedFile.originalName?.trim(),
              downloadURL: measurement.uploadedFile.downloadURL?.trim(),
              filePath: measurement.uploadedFile.filePath?.trim(),
              mimeType: measurement.uploadedFile.mimeType?.trim().toLowerCase(),
              fileType: measurement.uploadedFile.fileType?.trim().toLowerCase(),
            }
          : measurement.uploadedFile,
      })),
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
 * Middleware to validate project IDs exist in database
 */
export const validateProjectsExist = async (req, res, next) => {
  try {
    const { measurementBooks } = req.body;
    const { findMultipleProjectsByProjectId } = await import(
      "../utils/project-utils.js"
    );

    const projectIds = [
      ...new Set(measurementBooks.map((mb) => mb.project.trim())),
    ];

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
 * Complete validation pipeline for MB creation
 */
export const completeMBValidation = [
  validateMBData,
  sanitizeMBData,
  validateProjectsExist,
];

/**
 * Lightweight validation for update operations
 */
export const validateMBUpdateData = (req, res, next) => {
  try {
    const {
      mbNo,
      nameOfWork,
      location,
      contractor,
      tenderAgreement,
      aaOrFsNo,
      slNoOfBill,
      dateOfCommencement,
      dateOfCompletion,
      dateOfMeasurement,
      aaOrFsDate,
    } = req.body;

    const errors = [];

    // Validate optional field updates
    if (mbNo !== undefined && typeof mbNo !== "string") {
      errors.push("mbNo must be a string");
    }

    if (nameOfWork !== undefined) {
      if (typeof nameOfWork !== "string") {
        errors.push("nameOfWork must be a string");
      } else if (nameOfWork.trim().length < 5) {
        errors.push("nameOfWork must be at least 5 characters");
      } else if (nameOfWork.trim().length > 500) {
        errors.push("nameOfWork cannot exceed 500 characters");
      }
    }

    if (location !== undefined) {
      if (typeof location !== "string") {
        errors.push("location must be a string");
      } else if (location.trim().length > 200) {
        errors.push("location cannot exceed 200 characters");
      }
    }

    if (contractor !== undefined) {
      if (typeof contractor !== "string") {
        errors.push("contractor must be a string");
      } else if (contractor.trim().length > 200) {
        errors.push("contractor cannot exceed 200 characters");
      }
    }

    if (tenderAgreement !== undefined && tenderAgreement.trim().length > 200) {
      errors.push("tenderAgreement cannot exceed 200 characters");
    }

    if (
      dateOfCommencement !== undefined &&
      isNaN(Date.parse(dateOfCommencement))
    ) {
      errors.push("dateOfCommencement must be a valid date");
    }

    if (dateOfCompletion !== undefined && isNaN(Date.parse(dateOfCompletion))) {
      errors.push("dateOfCompletion must be a valid date");
    }

    if (
      dateOfMeasurement !== undefined &&
      isNaN(Date.parse(dateOfMeasurement))
    ) {
      errors.push("dateOfMeasurement must be a valid date");
    }

    if (
      aaOrFsDate !== undefined &&
      aaOrFsDate !== null &&
      isNaN(Date.parse(aaOrFsDate))
    ) {
      errors.push("aaOrFsDate must be a valid date");
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors,
      });
    }

    // Sanitize data
    const sanitizedData = {};
    if (mbNo !== undefined) sanitizedData.mbNo = mbNo.trim();
    if (nameOfWork !== undefined) sanitizedData.nameOfWork = nameOfWork.trim();
    if (location !== undefined) sanitizedData.location = location.trim();
    if (contractor !== undefined) sanitizedData.contractor = contractor.trim();
    if (tenderAgreement !== undefined)
      sanitizedData.tenderAgreement = tenderAgreement.trim();
    if (aaOrFsNo !== undefined) sanitizedData.aaOrFsNo = aaOrFsNo.trim();
    if (slNoOfBill !== undefined) sanitizedData.slNoOfBill = slNoOfBill.trim();

    req.body = sanitizedData;
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
