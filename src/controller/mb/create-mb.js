import ArchiveProject from "../../models/archive-project.model.js";
import MeasurementBook from "../../models/mb.model.js";

const createMeasurementBook = async (req, res) => {
  try {
    const {
      projectId,
      title,
      description,
      mbNumber,
      measurementDate,
      workOrderNumber,
      contractorName,
      remarks,
      uploadedFile, // Expecting file details from file upload middleware
    } = req.body;

    // Validate required fields
    const requiredFields = {
      projectId: "Project ID is required",
      title: "Title is required",
      description: "Description is required",
      mbNumber: "MB number is required",
      measurementDate: "Measurement date is required",
    };

    for (const [field, message] of Object.entries(requiredFields)) {
      if (!req.body[field]) {
        return res.status(400).json({
          success: false,
          message: message,
        });
      }
    }

    // Validate uploaded file
    if (!uploadedFile) {
      return res.status(400).json({
        success: false,
        message: "File upload is required",
      });
    }
    console.log(projectId);

    // Check if project exists
    const project = await ArchiveProject.findById({ _id: projectId });
    console.log(project);

    if (!project) {
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

    // Validate file type
    const allowedFileTypes = ["pdf", "jpg", "jpeg", "png"];
    if (!allowedFileTypes.includes(uploadedFile.fileType.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Only PDF, JPG, JPEG, and PNG files are allowed",
      });
    }

    // Check for duplicate MB number within the same project
    const existingMB = await MeasurementBook.findOne({
      projectId,
      mbNumber: mbNumber.trim(),
    });

    if (existingMB) {
      return res.status(409).json({
        success: false,
        message: "MB number already exists for this project",
      });
    }

    // Create new Measurement Book
    const measurementBook = new MeasurementBook({
      projectId,
      project: project._id,
      title: title.trim(),
      description: description.trim(),
      mbNumber: mbNumber.trim(),
      measurementDate: new Date(measurementDate),
      workOrderNumber: workOrderNumber?.trim(),
      contractorName: contractorName?.trim(),
      remarks: remarks?.trim(),
      uploadedFile: {
        fileName: uploadedFile.fileName,
        originalName: uploadedFile.originalName,
        fileType: uploadedFile.fileType.toLowerCase(),
        fileSize: uploadedFile.fileSize,
        filePath: uploadedFile.filePath,
        mimeType: uploadedFile.mimeType,
      },
      createdBy: {
        userId: req.user.userId,
        name: req.user.fullName || req.user.username,
        role: req.user.designation,
      },
    });

    const savedMB = await measurementBook.save();

    // Populate project details for response
    const populatedMB = await MeasurementBook.findById(savedMB._id).populate(
      "project",
      "projectName workOrderNumber"
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
        message: `${field} already exists`,
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export default createMeasurementBook;
