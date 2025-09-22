import MeasurementBook from "../../models/mb.model.js";

// Update measurement book
const updateMeasurementBook = async (req, res) => {
  try {
    const { mbId } = req.params;
    const { description, remarks } = req.body;

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    const measurementBook = await MeasurementBook.findById(mbId);

    if (!measurementBook) {
      return res.status(404).json({
        success: false,
        message: "Measurement book not found",
      });
    }

    // Update fields
    if (description) measurementBook.description = description.trim();
    if (remarks !== undefined) measurementBook.remarks = remarks?.trim();

    // Update lastModifiedBy
    measurementBook.lastModifiedBy = {
      userId: req.user.userId || req.user._id?.toString(),
      name: req.user.fullName || req.user.username || req.user.name,
      role: req.user.designation || req.user.role,
      modifiedAt: new Date(),
    };

    const updatedMB = await measurementBook.save();

    // Populate project details for response
    const populatedMB = await MeasurementBook.findById(updatedMB._id).populate(
      "project"
    );

    res.status(200).json({
      success: true,
      message: "Measurement book updated successfully",
      data: populatedMB,
    });
  } catch (error) {
    console.error("Error updating measurement book:", error);

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

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid measurement book ID format",
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

export default updateMeasurementBook;
