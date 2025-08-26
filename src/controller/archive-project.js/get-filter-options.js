import ArchiveProject from "../../models/archive-project.model.js";

const getFilterOptions = async (req, res) => {
  try {
    const [financialYears, contractors, engineers, locations] =
      await Promise.all([
        ArchiveProject.distinct("financialYear"),
        ArchiveProject.distinct("nameOfContractor"),
        ArchiveProject.distinct("concernedEngineer"),
        ArchiveProject.distinct("location"),
      ]);

    res.status(200).json({
      success: true,
      message: "Filter options retrieved successfully",
      data: {
        financialYears: financialYears.sort().reverse(), // Most recent first
        contractors: contractors.sort(),
        engineers: engineers.sort(),
        locations: locations.sort(),
        progressStatuses: [
          "Not Started",
          "Just Started",
          "In Progress",
          "Halfway Complete",
          "Near Completion",
          "Completed",
        ],
      },
    });
  } catch (error) {
    console.error("Error retrieving filter options:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving filter options",
    });
  }
};

export default getFilterOptions;
