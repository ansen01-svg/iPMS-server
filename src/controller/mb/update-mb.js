import MeasurementBook from "../../models/mb.model.js";

const updateMeasurementBook = async (req, res) => {
  try {
    const { mbId } = req.params;
    const {
      title,
      description,
      measurementDate,
      workOrderNumber,
      contractorName,
      remarks,
      status,
    } = req.body;

    // Check if MB exists
    const measurementBook = await MeasurementBook.findById(mbId);
    if (!measurementBook) {
      return res.status(404).json({
        success: false,
        message: "Measurement Book not found",
      });
    }

    // Check user authorization (only creator or higher authority can update)
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "User authentication required",
      });
    }

    // Update fields if provided
    const updateData = {};
    if (title) updateData.title = title.trim();
    if (description) updateData.description = description.trim();
    if (measurementDate) updateData.measurementDate = new Date(measurementDate);
    if (workOrderNumber) updateData.workOrderNumber = workOrderNumber.trim();
    if (contractorName) updateData.contractorName = contractorName.trim();
    if (remarks) updateData.remarks = remarks.trim();
    if (status) updateData.status = status;

    // Update lastModifiedBy
    updateData.lastModifiedBy = {
      userId: req.user.userId,
      name: req.user.fullName || req.user.username,
      role: req.user.designation,
      modifiedAt: new Date(),
    };

    const updatedMB = await MeasurementBook.findByIdAndUpdate(
      mbId,
      updateData,
      { new: true, runValidators: true }
    ).populate("project", "projectName workOrderNumber");

    res.json({
      success: true,
      message: "Measurement Book updated successfully",
      data: updatedMB,
    });
  } catch (error) {
    console.error("Error updating Measurement Book:", error);

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

    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export default updateMeasurementBook;
