import MeasurementBook from "../../models/mb.model.js";
import { getUnifiedProjectFields } from "../../utils/projects-filter.js";

// Get measurement book by ID with populated project details
const getMeasurementBookById = async (req, res) => {
  try {
    const { mbId } = req.params;

    const measurementBook = await MeasurementBook.findById(mbId).populate(
      "project"
    );

    if (!measurementBook) {
      return res.status(404).json({
        success: false,
        message: "Measurement book not found",
      });
    }

    // Get unified project fields
    const unifiedProject = getUnifiedProjectFields(
      measurementBook.project,
      measurementBook.projectType
    );

    res.status(200).json({
      success: true,
      data: {
        measurementBook: {
          ...measurementBook.toObject(),
          project: unifiedProject,
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

export default getMeasurementBookById;
