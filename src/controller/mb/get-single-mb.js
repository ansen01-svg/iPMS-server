import MeasurementBook from "../../models/mb.model.js";

const getSingleMeasurementBook = async (req, res) => {
  try {
    const { mbId } = req.params;

    // Validate mbId format
    if (!mbId || mbId.length !== 24) {
      return res.status(400).json({
        success: false,
        message: "Invalid Measurement Book ID format",
      });
    }

    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Find measurement book and populate project details
    const measurementBook = await MeasurementBook.findById(mbId).populate(
      "project",
      "projectName workOrderNumber estimatedCost district state"
    );

    if (!measurementBook) {
      return res.status(404).json({
        success: false,
        message: "Measurement Book not found",
      });
    }

    // Add computed fields using virtuals
    const mbData = measurementBook.toJSON();

    res.json({
      success: true,
      data: {
        ...mbData,
        // Include virtual fields
        fileUrl: measurementBook.fileUrl,
        humanReadableFileSize: measurementBook.humanReadableFileSize,
        // Additional metadata
        metadata: {
          isFileAvailable: !!(
            measurementBook.uploadedFile &&
            measurementBook.uploadedFile.downloadURL
          ),
          hasRemarks: !!measurementBook.remarks,
          isApproved: !!measurementBook.approvedBy,
          isRejected: !!measurementBook.rejectionReason,
          lastModified:
            measurementBook.lastModifiedBy?.modifiedAt ||
            measurementBook.updatedAt,
          ageInDays: Math.floor(
            (new Date() - new Date(measurementBook.createdAt)) /
              (1000 * 60 * 60 * 24)
          ),
        },
      },
    });
  } catch (error) {
    console.error("Error fetching Measurement Book:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid Measurement Book ID format",
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

export default getSingleMeasurementBook;
