import ArchiveProject from "../../models/archive-project.model.js";
import MeasurementBook from "../../models/mb.model.js";

const createMeasurementBook = async (req, res) => {
  try {
    const {
      project,
      description,
      remarks,
      uploadedFile, // This comes from the Firebase middleware
    } = req.body;

    // Validate required fields based on schema
    if (!project) {
      return res.status(400).json({
        success: false,
        message: "Project reference is required",
      });
    }

    if (!description) {
      return res.status(400).json({
        success: false,
        message: "Description is required",
      });
    }

    // Validate uploaded file (should be set by middleware)
    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: "File upload is required",
      });
    }

    // Check if project exists
    const existingProject = await ArchiveProject.findById(project);
    if (!existingProject) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Create new Measurement Book based on actual schema
    const measurementBook = new MeasurementBook({
      project: existingProject._id,
      description: description.trim(),
      remarks: remarks?.trim(),
      uploadedFile: {
        fileName: uploadedFile.fileName,
        originalName: uploadedFile.originalName,
        downloadURL: uploadedFile.downloadURL,
        filePath: uploadedFile.filePath,
        fileSize: uploadedFile.fileSize,
        mimeType: uploadedFile.mimeType,
        fileType: uploadedFile.fileType,
        uploadedAt: new Date(),
      },
      createdBy: {
        userId: req.user.userId || req.user._id?.toString(),
        name: req.user.fullName || req.user.username || req.user.name,
        role: req.user.designation || req.user.role,
      },
    });

    // Save the measurement book
    const savedMB = await measurementBook.save();

    // Populate project details for response
    const populatedMB = await MeasurementBook.findById(savedMB._id).populate(
      "project",
      "projectName workOrderNumber estimatedCost district"
    );

    res.status(201).json({
      success: true,
      message: "Measurement Book created successfully",
      data: populatedMB,
    });
  } catch (error) {
    console.error("Error creating Measurement Book:", error);

    // Handle validation errors
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

export default createMeasurementBook;
