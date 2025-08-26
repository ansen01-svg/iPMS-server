import ArchiveProject from "../../models/archive-project.model.js";

export const getArchiveProjectsSummary = async (req, res) => {
  try {
    const { financialYear, concernedEngineer } = req.query;
    const filter = {};

    if (financialYear) filter.financialYear = financialYear;
    if (concernedEngineer) filter.concernedEngineer = concernedEngineer;

    const summary = await ArchiveProject.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          totalWorkValue: { $sum: "$workValue" },
          totalAAAmount: { $sum: "$AAAmount" },
          totalBillSubmitted: { $sum: "$billSubmittedAmount" },
          avgProgress: { $avg: "$progress" },
          maxWorkValue: { $max: "$workValue" },
          minWorkValue: { $min: "$workValue" },
          completedProjects: {
            $sum: { $cond: [{ $eq: ["$progress", 100] }, 1, 0] },
          },
          inProgressProjects: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$progress", 0] },
                    { $lt: ["$progress", 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          notStartedProjects: {
            $sum: { $cond: [{ $eq: ["$progress", 0] }, 1, 0] },
          },
        },
      },
    ]);

    const result = summary[0] || {
      totalProjects: 0,
      totalWorkValue: 0,
      totalAAAmount: 0,
      totalBillSubmitted: 0,
      avgProgress: 0,
      maxWorkValue: 0,
      minWorkValue: 0,
      completedProjects: 0,
      inProgressProjects: 0,
      notStartedProjects: 0,
    };

    // Get top contractors and engineers
    const topContractors = await ArchiveProject.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$nameOfContractor",
          projectCount: { $sum: 1 },
          totalValue: { $sum: "$workValue" },
          avgProgress: { $avg: "$progress" },
        },
      },
      { $sort: { totalValue: -1 } },
      { $limit: 5 },
    ]);

    const topEngineers = await ArchiveProject.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$concernedEngineer",
          projectCount: { $sum: 1 },
          totalValue: { $sum: "$workValue" },
          avgProgress: { $avg: "$progress" },
        },
      },
      { $sort: { projectCount: -1 } },
      { $limit: 5 },
    ]);

    res.status(200).json({
      success: true,
      message: "Archive projects summary retrieved successfully",
      data: {
        overview: {
          ...result,
          avgProgress: Math.round(result.avgProgress * 100) / 100,
          completionRate:
            result.totalProjects > 0
              ? Math.round(
                  (result.completedProjects / result.totalProjects) * 100
                )
              : 0,
          totalRemainingValue:
            result.totalWorkValue - result.totalBillSubmitted,
        },
        topContractors: topContractors.map((contractor) => ({
          name: contractor._id,
          projectCount: contractor.projectCount,
          totalValue: contractor.totalValue,
          avgProgress: Math.round(contractor.avgProgress * 100) / 100,
        })),
        topEngineers: topEngineers.map((engineer) => ({
          name: engineer._id,
          projectCount: engineer.projectCount,
          totalValue: engineer.totalValue,
          avgProgress: Math.round(engineer.avgProgress * 100) / 100,
        })),
      },
      filters: {
        financialYear: financialYear || null,
        concernedEngineer: concernedEngineer || null,
      },
    });
  } catch (error) {
    console.error("Error retrieving archive projects summary:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving summary",
      error:
        process.env.NODE_ENV === "development"
          ? {
              name: error.name,
              message: error.message,
            }
          : undefined,
    });
  }
};
