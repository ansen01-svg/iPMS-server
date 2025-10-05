import mongoose from "mongoose";
import ArchiveProject from "../../models/archive-project.model.js";
import MeasurementBook from "../../models/mb.model.js";
import Project from "../../models/project.model.js";

const createMeasurementBooks = async (req, res) => {
  const session = await mongoose.startSession();
  let transactionCommitted = false;

  try {
    await session.startTransaction();

    const { measurementBooks } = req.body;

    // Validate that measurementBooks is an array
    if (!Array.isArray(measurementBooks) || measurementBooks.length === 0) {
      return res.status(400).json({
        success: false,
        message: "measurementBooks must be a non-empty array",
      });
    }

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const validatedMBs = [];
    const errors = [];

    // Validate each measurement book in the array
    for (let i = 0; i < measurementBooks.length; i++) {
      const mbData = measurementBooks[i];
      const index = i + 1;

      try {
        // Validate required fields
        if (!mbData.project) {
          errors.push(`MB ${index}: Project ID is required`);
          continue;
        }

        if (!mbData.mbNo) {
          errors.push(`MB ${index}: MB Number is required`);
          continue;
        }

        if (!mbData.nameOfWork) {
          errors.push(`MB ${index}: Name of Work is required`);
          continue;
        }

        if (!mbData.location) {
          errors.push(`MB ${index}: Location is required`);
          continue;
        }

        if (!mbData.contractor) {
          errors.push(`MB ${index}: Contractor is required`);
          continue;
        }

        if (!mbData.dateOfCommencement) {
          errors.push(`MB ${index}: Date of Commencement is required`);
          continue;
        }

        if (!mbData.dateOfCompletion) {
          errors.push(`MB ${index}: Date of Completion is required`);
          continue;
        }

        if (!mbData.dateOfMeasurement) {
          errors.push(`MB ${index}: Date of Measurement is required`);
          continue;
        }

        if (
          !mbData.measurements ||
          !Array.isArray(mbData.measurements) ||
          mbData.measurements.length === 0
        ) {
          errors.push(`MB ${index}: At least one measurement item is required`);
          continue;
        }

        // Validate each measurement item
        for (let j = 0; j < mbData.measurements.length; j++) {
          const measurement = mbData.measurements[j];
          const measurementIndex = j + 1;

          if (!measurement.description) {
            errors.push(
              `MB ${index}, Measurement ${measurementIndex}: Description is required`
            );
            continue;
          }

          if (!measurement.unit) {
            errors.push(
              `MB ${index}, Measurement ${measurementIndex}: Unit is required`
            );
            continue;
          }

          if (!measurement.uploadedFile) {
            errors.push(
              `MB ${index}, Measurement ${measurementIndex}: File upload is required`
            );
            continue;
          }
        }

        // Find project by projectId string in both Project and ArchiveProject collections
        let existingProject = null;
        let projectType = null;

        existingProject = await Project.findOne({
          projectId: mbData.project,
        }).session(session);

        if (existingProject) {
          projectType = "Project";
        } else {
          existingProject = await ArchiveProject.findOne({
            projectId: mbData.project,
          }).session(session);
          if (existingProject) {
            projectType = "ArchiveProject";
          }
        }

        if (!existingProject) {
          errors.push(
            `MB ${index}: Project with ID '${mbData.project}' not found in either Project or ArchiveProject collections`
          );
          continue;
        }

        // Generate unique MB ID
        const mbId = await MeasurementBook.generateMBId();

        // Create MB object with proper structure
        const measurementBookData = {
          project: existingProject._id,
          projectType,
          mbId,
          mbNo: mbData.mbNo.trim(),
          nameOfWork: mbData.nameOfWork.trim(),
          location: mbData.location.trim(),
          contractor: mbData.contractor.trim(),
          tenderAgreement: mbData.tenderAgreement?.trim(),
          aaOrFsNo: mbData.aaOrFsNo?.trim(),
          aaOrFsDate: mbData.aaOrFsDate
            ? new Date(mbData.aaOrFsDate)
            : undefined,
          slNoOfBill: mbData.slNoOfBill?.trim(),
          dateOfCommencement: new Date(mbData.dateOfCommencement),
          dateOfCompletion: new Date(mbData.dateOfCompletion),
          dateOfMeasurement: new Date(mbData.dateOfMeasurement),
          measurements: mbData.measurements.map((measurement) => ({
            id: measurement.id,
            description: measurement.description.trim(),
            unit: measurement.unit.trim(),
            uploadedFile: {
              fileName: measurement.uploadedFile.fileName,
              originalName: measurement.uploadedFile.originalName,
              downloadURL: measurement.uploadedFile.downloadURL,
              filePath: measurement.uploadedFile.filePath,
              fileSize: measurement.uploadedFile.fileSize,
              mimeType: measurement.uploadedFile.mimeType,
              fileType: measurement.uploadedFile.fileType,
              uploadedAt: new Date(),
            },
          })),
          createdBy: {
            userId: req.user.userId || req.user._id?.toString(),
            name: req.user.fullName || req.user.username || req.user.name,
            role: req.user.designation || req.user.role,
          },
        };

        // Add metadata for response
        measurementBookData._projectId = mbData.project;
        measurementBookData._projectType = projectType;

        validatedMBs.push(measurementBookData);
      } catch (error) {
        errors.push(`MB ${index}: ${error.message}`);
      }
    }

    // If there are validation errors, return them
    if (errors.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Validation failed for some measurement books",
        errors,
        validatedCount: validatedMBs.length,
        totalCount: measurementBooks.length,
      });
    }

    // Create all measurement books in a transaction
    const savedMBs = await MeasurementBook.createMultiple(
      validatedMBs,
      session
    );

    // Commit the transaction
    await session.commitTransaction();
    transactionCommitted = true;

    res.status(201).json({
      success: true,
      message: `${savedMBs.length} Measurement Book(s) created successfully`,
      data: {
        measurementBooks: savedMBs.map((mb) => ({
          mbId: mb.mbId,
          mbNo: mb.mbNo,
          nameOfWork: mb.nameOfWork,
          project: mb._projectId || mb.project,
          projectType: mb._projectType || mb.projectType,
          totalMeasurements: mb.measurements.length,
        })),
        summary: {
          totalCreated: savedMBs.length,
          totalMeasurementItems: savedMBs.reduce(
            (sum, mb) => sum + mb.measurements.length,
            0
          ),
        },
      },
    });
  } catch (error) {
    if (!transactionCommitted) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        console.error("Error aborting transaction:", abortError);
      }
    }

    console.error("Error creating Measurement Books:", error);

    // Handle specific MongoDB errors
    if (error.name === "ValidationError") {
      const validationErrors = Object.values(error.errors).map(
        (err) => err.message
      );
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validationErrors,
      });
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: `Duplicate ${field} already exists`,
      });
    }

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid data format",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  } finally {
    try {
      await session.endSession();
    } catch (endSessionError) {
      console.error("Error ending session:", endSessionError);
    }
  }
};

// Backward compatibility: Single MB creation
const createSingleMeasurementBook = async (req, res) => {
  const originalBody = req.body;
  req.body = {
    measurementBooks: [originalBody],
  };

  await createMeasurementBooks(req, res);
};

export default createMeasurementBooks;
export { createSingleMeasurementBook };
