import MeasurementBook from "../../models/mb.model.js";

const deleteMeasurementBook = async (req, res) => {
  try {
    const { mbId } = req.params;

    const measurementBook = await MeasurementBook.findById(mbId);
    if (!measurementBook) {
      return res.status(404).json({
        success: false,
        message: "Measurement Book not found",
      });
    }

    // Check authorization (only creator or admin can delete)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Only allow deletion by creator or admin roles
    const canDelete =
      measurementBook.createdBy.userId === req.user.userId ||
      ["ADMIN", "AEE", "CE", "MD"].includes(req.user.designation);

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        message: "You are not authorized to delete this Measurement Book",
      });
    }

    await MeasurementBook.findByIdAndDelete(mbId);

    res.json({
      success: true,
      message: "Measurement Book deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting Measurement Book:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export default deleteMeasurementBook;
