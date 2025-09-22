import mongoose from "mongoose";
import ArchiveProject from "../../models/archive-project.model.js";
import MeasurementBook from "../../models/mb.model.js";
import Project from "../../models/project.model.js";

const createMeasurementBooks = async (req, res) => {
  // Start a session for transaction
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

        if (!mbData.description) {
          errors.push(`MB ${index}: Description is required`);
          continue;
        }

        if (!mbData.uploadedFile) {
          errors.push(`MB ${index}: File upload is required`);
          continue;
        }

        // Find project by projectId string in both Project and ArchiveProject collections
        let existingProject = null;
        let projectType = null;

        // First check in Project collection using projectId field
        existingProject = await Project.findOne({
          projectId: mbData.project,
        }).session(session);
        if (existingProject) {
          projectType = "Project";
        } else {
          // If not found in Project, check in ArchiveProject using projectId field
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

        // Create MB object with proper structure
        // Note: We store the MongoDB _id in the project field, but lookup was done by projectId
        const measurementBookData = {
          project: existingProject._id, // Store MongoDB ObjectId
          projectType,
          description: mbData.description.trim(),
          remarks: mbData.remarks?.trim(),
          uploadedFile: {
            fileName: mbData.uploadedFile.fileName,
            originalName: mbData.uploadedFile.originalName,
            downloadURL: mbData.uploadedFile.downloadURL,
            filePath: mbData.uploadedFile.filePath,
            fileSize: mbData.uploadedFile.fileSize,
            mimeType: mbData.uploadedFile.mimeType,
            fileType: mbData.uploadedFile.fileType,
            uploadedAt: new Date(),
          },
          createdBy: {
            userId: req.user.userId || req.user._id?.toString(),
            name: req.user.fullName || req.user.username || req.user.name,
            role: req.user.designation || req.user.role,
          },
        };

        // Add metadata for response
        measurementBookData._projectId = mbData.project; // Store original projectId for reference
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
      message: `${savedMBs.length} Measurement Books created successfully`,
      data: {
        summary: {
          totalCreated: savedMBs.length,
        },
      },
    });
  } catch (error) {
    // Only rollback transaction if it hasn't been committed yet
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

    // Handle duplicate key error
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(409).json({
        success: false,
        message: `Duplicate ${field} already exists`,
      });
    }

    // Handle cast errors (invalid ObjectId)
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
    // End the session
    try {
      await session.endSession();
    } catch (endSessionError) {
      console.error("Error ending session:", endSessionError);
    }
  }
};

// Backward compatibility: Single MB creation
const createSingleMeasurementBook = async (req, res) => {
  // Wrap single MB data in array format and call the main function
  const originalBody = req.body;
  req.body = {
    measurementBooks: [originalBody],
  };

  const result = await createMeasurementBooks(req, res);

  // If successful, modify response to return single object instead of array
  if (res.statusCode === 201) {
    // Note: This is a simplified approach. In a real implementation,
    // you might want to modify the response format more carefully
    return;
  }

  return result;
};

export default createMeasurementBooks;
export { createSingleMeasurementBook };
