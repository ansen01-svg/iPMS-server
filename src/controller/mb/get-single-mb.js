import MeasurementBook from "../../models/mb.model.js";

/**
 * Get a single measurement book by MB ID or MongoDB _id
 */
const getSingleMeasurementBook = async (req, res) => {
  try {
    const { id } = req.params;

    // Try to find by mbId first (e.g., MB_123), then by MongoDB _id
    let measurementBook = await MeasurementBook.findOne({
      mbId: id.toUpperCase(),
    })
      .populate("project")
      .lean();

    if (!measurementBook) {
      // Try to find by MongoDB _id
      measurementBook = await MeasurementBook.findById(id)
        .populate("project")
        .lean();
    }

    if (!measurementBook) {
      return res.status(404).json({
        success: false,
        message: `Measurement Book with ID '${id}' not found`,
      });
    }

    res.status(200).json({
      success: true,
      data: {
        measurementBook: {
          ...measurementBook,
          totalMeasurements: measurementBook.measurements?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching measurement book:", error);

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

export default getSingleMeasurementBook;
