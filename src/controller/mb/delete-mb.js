import MeasurementBook from "../../models/mb.model.js";

// Delete measurement book (soft delete)
const deleteMeasurementBook = async (req, res) => {
  try {
    const { mbId } = req.params;

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

    // For now, we'll do hard delete. You can implement soft delete by adding an 'isActive' field
    await MeasurementBook.findByIdAndDelete(mbId);

    res.status(200).json({
      success: true,
      message: "Measurement book deleted successfully",
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
