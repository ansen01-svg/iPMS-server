import MeasurementBook from "../../models/mb.model.js";
import { deleteMultipleFilesFromFirebase } from "../../utils/firebase.js";

/**
 * Delete a measurement book and all its associated files
 */
const deleteMeasurementBook = async (req, res) => {
  try {
    const { id } = req.params;

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

    // Collect all file paths for deletion
    const filePaths = measurementBook.measurements.map(
      (measurement) => measurement.uploadedFile.filePath
    );

    // Delete the measurement book from database
    await MeasurementBook.findByIdAndDelete(measurementBook._id);

    // Delete all associated files from Firebase
    if (filePaths.length > 0) {
      try {
        await deleteMultipleFilesFromFirebase(filePaths);
        console.log(`Deleted ${filePaths.length} files from Firebase`);
      } catch (fileError) {
        console.error("Error deleting files from Firebase:", fileError);
        // Continue even if file deletion fails
      }
    }

    res.status(200).json({
      success: true,
      message: "Measurement Book deleted successfully",
      data: {
        mbId: measurementBook.mbId,
        mbNo: measurementBook.mbNo,
        deletedFiles: filePaths.length,
      },
    });
  } catch (error) {
    console.error("Error deleting measurement book:", error);

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

export default deleteMeasurementBook;
