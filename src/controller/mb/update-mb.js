import MeasurementBook from "../../models/mb.model.js";

/**
 * Update a measurement book's basic information
 * Does not update measurements array - use separate endpoints for that
 */
const updateMeasurementBook = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Find the measurement book
    let measurementBook = await MeasurementBook.findOne({
      mbId: id.toUpperCase(),
    });

    if (!measurementBook) {
      measurementBook = await MeasurementBook.findById(id);
    }

    if (!measurementBook) {
      return res.status(404).json({
        success: false,
        message: `Measurement Book with ID '${id}' not found`,
      });
    }

    // Fields that can be updated
    const allowedUpdates = [
      "mbNo",
      "nameOfWork",
      "location",
      "contractor",
      "tenderAgreement",
      "aaOrFsNo",
      "aaOrFsDate",
      "slNoOfBill",
      "dateOfCommencement",
      "dateOfCompletion",
      "dateOfMeasurement",
    ];

    // Apply updates
    allowedUpdates.forEach((field) => {
      if (updateData[field] !== undefined) {
        measurementBook[field] = updateData[field];
      }
    });

    // Update lastModifiedBy
    measurementBook.lastModifiedBy = {
      userId: req.user.userId || req.user._id?.toString(),
      name: req.user.fullName || req.user.username || req.user.name,
      role: req.user.designation || req.user.role,
      modifiedAt: new Date(),
    };

    // Save the updated measurement book
    await measurementBook.save();

    res.status(200).json({
      success: true,
      message: "Measurement Book updated successfully",
      data: {
        measurementBook: {
          mbId: measurementBook.mbId,
          mbNo: measurementBook.mbNo,
          nameOfWork: measurementBook.nameOfWork,
          location: measurementBook.location,
          contractor: measurementBook.contractor,
          lastModifiedBy: measurementBook.lastModifiedBy,
        },
      },
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
        message: "Invalid data format",
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
