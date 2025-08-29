import MeasurementBook from "../../models/mb.model.js";

const getSingleMeasurementBook = async (req, res) => {
  try {
    const { mbId } = req.params;

    const measurementBook = await MeasurementBook.findById(mbId).populate(
      "project",
      "projectName workOrderNumber estimatedCost district"
    );

    if (!measurementBook) {
      return res.status(404).json({
        success: false,
        message: "Measurement Book not found",
      });
    }

    res.json({
      success: true,
      data: measurementBook,
    });
  } catch (error) {
    console.error("Error fetching Measurement Book:", error);

    // Handle invalid ObjectId
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid Measurement Book ID",
      });
    }

    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

export default getSingleMeasurementBook;
