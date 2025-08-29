import MeasurementBook from "../../models/mb.model.js";

export const exportMBData = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { status, startDate, endDate } = req.query;
    console.log(projectId);

    // Build query
    let query = { projectId };

    if (status && status !== "all") {
      query.status = status;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Get MBs with project details
    const measurementBooks = await MeasurementBook.find(query)
      .populate("project", "projectName workOrderNumber")
      .sort({ createdAt: -1 })
      .lean();

    // Convert to CSV format
    const csvHeaders = [
      "MB Number",
      "Title",
      "Description",
      "Project Name",
      "Work Order Number",
      "Contractor Name",
      "Measurement Date",
      "Status",
      "File Type",
      "File Size (MB)",
      "Created By",
      "Created At",
      "Remarks",
    ];

    const csvRows = measurementBooks.map((mb) => [
      mb.mbNumber,
      `"${mb.title}"`,
      `"${mb.description}"`,
      `"${mb.project}"`,
      mb.workOrderNumber,
      mb.contractorName || "",
      new Date(mb.measurementDate).toLocaleDateString(),
      mb.status,
      mb.uploadedFile.fileType.toUpperCase(),
      (mb.uploadedFile.fileSize / (1024 * 1024)).toFixed(2),
      mb.createdBy.name,
      new Date(mb.createdAt).toLocaleDateString(),
      `"${mb.remarks || ""}"`,
    ]);

    const csvContent = [
      csvHeaders.join(","),
      ...csvRows.map((row) => row.join(",")),
    ].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="measurement-books-${projectId}-${Date.now()}.csv"`
    );
    res.send(csvContent);
  } catch (error) {
    console.error("Error exporting MB data:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
