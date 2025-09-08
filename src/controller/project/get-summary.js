import Project from "../../models/project.model.js";

export const getProjectsSummary = async (req, res) => {
  try {
    const { status, district, fund, createdBy, typeOfWork, contractorName } =
      req.query;
    const filter = {};

    // Apply filters
    if (status) filter.status = status;
    if (district) filter.district = district;
    if (fund) filter.fund = fund;
    if (createdBy) filter["createdBy.userId"] = createdBy;
    if (typeOfWork) filter.typeOfWork = typeOfWork;
    if (contractorName) filter.contractorName = new RegExp(contractorName, "i");

    const summary = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalProjects: { $sum: 1 },
          totalEstimatedCost: { $sum: "$estimatedCost" },
          totalBillSubmitted: { $sum: "$billSubmittedAmount" },
          avgPhysicalProgress: { $avg: "$progressPercentage" },
          avgFinancialProgress: { $avg: "$financialProgress" },
          maxEstimatedCost: { $max: "$estimatedCost" },
          minEstimatedCost: { $min: "$estimatedCost" },

          // Physical Progress Statistics
          physicallyCompletedProjects: {
            $sum: { $cond: [{ $eq: ["$progressPercentage", 100] }, 1, 0] },
          },
          physicallyInProgressProjects: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$progressPercentage", 0] },
                    { $lt: ["$progressPercentage", 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          physicallyNotStartedProjects: {
            $sum: { $cond: [{ $eq: ["$progressPercentage", 0] }, 1, 0] },
          },

          // Financial Progress Statistics
          financiallyCompletedProjects: {
            $sum: { $cond: [{ $eq: ["$financialProgress", 100] }, 1, 0] },
          },
          financiallyInProgressProjects: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$financialProgress", 0] },
                    { $lt: ["$financialProgress", 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          financiallyNotStartedProjects: {
            $sum: { $cond: [{ $eq: ["$financialProgress", 0] }, 1, 0] },
          },

          // Combined Completion Statistics
          fullyCompletedProjects: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$progressPercentage", 100] },
                    { $eq: ["$financialProgress", 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },

          // Status-based grouping
          submittedToAEE: {
            $sum: { $cond: [{ $eq: ["$status", "Submitted to AEE"] }, 1, 0] },
          },
          submittedToCE: {
            $sum: { $cond: [{ $eq: ["$status", "Submitted to CE"] }, 1, 0] },
          },
          submittedToMD: {
            $sum: { $cond: [{ $eq: ["$status", "Submitted to MD"] }, 1, 0] },
          },
          approvedProjects: {
            $sum: { $cond: [{ $eq: ["$status", "Approved"] }, 1, 0] },
          },
          ongoingProjects: {
            $sum: { $cond: [{ $eq: ["$status", "Ongoing"] }, 1, 0] },
          },
          completedStatusProjects: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
          },
          rejectedProjects: {
            $sum: { $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0] },
          },
          onHoldProjects: {
            $sum: { $cond: [{ $eq: ["$status", "On Hold"] }, 1, 0] },
          },

          // Progress update statistics
          totalProgressUpdates: { $sum: { $size: "$progressUpdates" } },
          totalFinancialProgressUpdates: {
            $sum: { $size: "$financialProgressUpdates" },
          },

          // Sub-projects statistics
          totalSubProjects: { $sum: { $size: "$subProjects" } },
          projectsWithSubProjects: {
            $sum: { $cond: [{ $eq: ["$hasSubProjects", true] }, 1, 0] },
          },

          // Contractor statistics
          uniqueContractors: { $addToSet: "$contractorName" },
        },
      },
      {
        $addFields: {
          totalUniqueContractors: { $size: "$uniqueContractors" },
        },
      },
    ]);

    const result = summary[0] || {
      totalProjects: 0,
      totalEstimatedCost: 0,
      totalBillSubmitted: 0,
      avgPhysicalProgress: 0,
      avgFinancialProgress: 0,
      maxEstimatedCost: 0,
      minEstimatedCost: 0,
      physicallyCompletedProjects: 0,
      physicallyInProgressProjects: 0,
      physicallyNotStartedProjects: 0,
      financiallyCompletedProjects: 0,
      financiallyInProgressProjects: 0,
      financiallyNotStartedProjects: 0,
      fullyCompletedProjects: 0,
      submittedToAEE: 0,
      submittedToCE: 0,
      submittedToMD: 0,
      approvedProjects: 0,
      ongoingProjects: 0,
      completedStatusProjects: 0,
      rejectedProjects: 0,
      onHoldProjects: 0,
      totalProgressUpdates: 0,
      totalFinancialProgressUpdates: 0,
      totalSubProjects: 0,
      projectsWithSubProjects: 0,
      totalUniqueContractors: 0,
    };

    // Get top performers by different criteria
    const [topDistricts, topFunds, topCreators, topTypeOfWork, topContractors] =
      await Promise.all([
        // Top districts by project count and value
        Project.aggregate([
          { $match: filter },
          {
            $group: {
              _id: "$district",
              projectCount: { $sum: 1 },
              totalValue: { $sum: "$estimatedCost" },
              avgPhysicalProgress: { $avg: "$progressPercentage" },
              avgFinancialProgress: { $avg: "$financialProgress" },
              completedProjects: {
                $sum: { $cond: [{ $eq: ["$progressPercentage", 100] }, 1, 0] },
              },
              uniqueContractors: { $addToSet: "$contractorName" },
            },
          },
          {
            $addFields: {
              contractorCount: { $size: "$uniqueContractors" },
            },
          },
          { $sort: { projectCount: -1 } },
          { $limit: 10 },
        ]),

        // Top funds by project count and value
        Project.aggregate([
          { $match: filter },
          {
            $group: {
              _id: "$fund",
              projectCount: { $sum: 1 },
              totalValue: { $sum: "$estimatedCost" },
              avgPhysicalProgress: { $avg: "$progressPercentage" },
              avgFinancialProgress: { $avg: "$financialProgress" },
              completedProjects: {
                $sum: { $cond: [{ $eq: ["$progressPercentage", 100] }, 1, 0] },
              },
              uniqueContractors: { $addToSet: "$contractorName" },
            },
          },
          {
            $addFields: {
              contractorCount: { $size: "$uniqueContractors" },
            },
          },
          { $sort: { totalValue: -1 } },
          { $limit: 10 },
        ]),

        // Top creators by project count and performance
        Project.aggregate([
          { $match: filter },
          {
            $group: {
              _id: {
                userId: "$createdBy.userId",
                name: "$createdBy.name",
                role: "$createdBy.role",
              },
              projectCount: { $sum: 1 },
              totalValue: { $sum: "$estimatedCost" },
              avgPhysicalProgress: { $avg: "$progressPercentage" },
              avgFinancialProgress: { $avg: "$financialProgress" },
              completedProjects: {
                $sum: { $cond: [{ $eq: ["$progressPercentage", 100] }, 1, 0] },
              },
              uniqueContractors: { $addToSet: "$contractorName" },
            },
          },
          {
            $addFields: {
              contractorCount: { $size: "$uniqueContractors" },
            },
          },
          { $sort: { projectCount: -1 } },
          { $limit: 10 },
        ]),

        // Top types of work by project count
        Project.aggregate([
          { $match: filter },
          {
            $group: {
              _id: "$typeOfWork",
              projectCount: { $sum: 1 },
              totalValue: { $sum: "$estimatedCost" },
              avgPhysicalProgress: { $avg: "$progressPercentage" },
              avgFinancialProgress: { $avg: "$financialProgress" },
              completedProjects: {
                $sum: { $cond: [{ $eq: ["$progressPercentage", 100] }, 1, 0] },
              },
              uniqueContractors: { $addToSet: "$contractorName" },
            },
          },
          {
            $addFields: {
              contractorCount: { $size: "$uniqueContractors" },
            },
          },
          { $sort: { projectCount: -1 } },
          { $limit: 10 },
        ]),

        // Top contractors by project count and performance
        Project.aggregate([
          { $match: filter },
          {
            $group: {
              _id: {
                contractorName: "$contractorName",
                contractorPhone: "$contractorPhoneNumber",
              },
              projectCount: { $sum: 1 },
              totalValue: { $sum: "$estimatedCost" },
              totalBillSubmitted: { $sum: "$billSubmittedAmount" },
              avgPhysicalProgress: { $avg: "$progressPercentage" },
              avgFinancialProgress: { $avg: "$financialProgress" },
              completedProjects: {
                $sum: { $cond: [{ $eq: ["$progressPercentage", 100] }, 1, 0] },
              },
              financiallyCompletedProjects: {
                $sum: { $cond: [{ $eq: ["$financialProgress", 100] }, 1, 0] },
              },
              ongoingProjects: {
                $sum: { $cond: [{ $eq: ["$status", "Ongoing"] }, 1, 0] },
              },
              districts: { $addToSet: "$district" },
              workTypes: { $addToSet: "$typeOfWork" },
            },
          },
          {
            $addFields: {
              districtCount: { $size: "$districts" },
              workTypeCount: { $size: "$workTypes" },
              avgProjectValue: { $divide: ["$totalValue", "$projectCount"] },
              budgetUtilization: {
                $cond: [
                  { $gt: ["$totalValue", 0] },
                  {
                    $multiply: [
                      { $divide: ["$totalBillSubmitted", "$totalValue"] },
                      100,
                    ],
                  },
                  0,
                ],
              },
            },
          },
          { $sort: { projectCount: -1 } },
          { $limit: 15 },
        ]),
      ]);

    // Calculate derived metrics
    const derivedMetrics = {
      // Completion rates
      physicalCompletionRate:
        result.totalProjects > 0
          ? Math.round(
              (result.physicallyCompletedProjects / result.totalProjects) * 100
            )
          : 0,
      financialCompletionRate:
        result.totalProjects > 0
          ? Math.round(
              (result.financiallyCompletedProjects / result.totalProjects) * 100
            )
          : 0,
      fullCompletionRate:
        result.totalProjects > 0
          ? Math.round(
              (result.fullyCompletedProjects / result.totalProjects) * 100
            )
          : 0,

      // Budget metrics
      totalRemainingBudget:
        result.totalEstimatedCost - result.totalBillSubmitted,
      budgetUtilizationRate:
        result.totalEstimatedCost > 0
          ? Math.round(
              (result.totalBillSubmitted / result.totalEstimatedCost) * 100
            )
          : 0,
      avgProjectValue:
        result.totalProjects > 0
          ? Math.round(result.totalEstimatedCost / result.totalProjects)
          : 0,

      // Progress metrics
      avgProgressGap: Math.abs(
        (result.avgPhysicalProgress || 0) - (result.avgFinancialProgress || 0)
      ),
      totalUpdatesCount:
        result.totalProgressUpdates + result.totalFinancialProgressUpdates,
      avgUpdatesPerProject:
        result.totalProjects > 0
          ? Math.round(
              ((result.totalProgressUpdates +
                result.totalFinancialProgressUpdates) /
                result.totalProjects) *
                100
            ) / 100
          : 0,

      // Sub-projects metrics
      avgSubProjectsPerProject:
        result.projectsWithSubProjects > 0
          ? Math.round(
              (result.totalSubProjects / result.projectsWithSubProjects) * 100
            ) / 100
          : 0,
      subProjectsUtilizationRate:
        result.totalProjects > 0
          ? Math.round(
              (result.projectsWithSubProjects / result.totalProjects) * 100
            )
          : 0,

      // Status distribution
      approvalPipelineProjects:
        result.submittedToAEE + result.submittedToCE + result.submittedToMD,
      activeProjects: result.approvedProjects + result.ongoingProjects,

      // Contractor metrics
      avgProjectsPerContractor:
        result.totalUniqueContractors > 0
          ? Math.round(
              (result.totalProjects / result.totalUniqueContractors) * 100
            ) / 100
          : 0,
    };

    // Format response data
    const formattedTopData = {
      districts: topDistricts.map((district) => ({
        name: district._id,
        projectCount: district.projectCount,
        totalValue: district.totalValue,
        avgPhysicalProgress:
          Math.round(district.avgPhysicalProgress * 100) / 100,
        avgFinancialProgress:
          Math.round(district.avgFinancialProgress * 100) / 100,
        completedProjects: district.completedProjects,
        contractorCount: district.contractorCount,
        completionRate:
          district.projectCount > 0
            ? Math.round(
                (district.completedProjects / district.projectCount) * 100
              )
            : 0,
      })),

      funds: topFunds.map((fund) => ({
        name: fund._id,
        projectCount: fund.projectCount,
        totalValue: fund.totalValue,
        avgPhysicalProgress: Math.round(fund.avgPhysicalProgress * 100) / 100,
        avgFinancialProgress: Math.round(fund.avgFinancialProgress * 100) / 100,
        completedProjects: fund.completedProjects,
        contractorCount: fund.contractorCount,
        completionRate:
          fund.projectCount > 0
            ? Math.round((fund.completedProjects / fund.projectCount) * 100)
            : 0,
      })),

      creators: topCreators.map((creator) => ({
        userId: creator._id.userId,
        name: creator._id.name,
        role: creator._id.role,
        projectCount: creator.projectCount,
        totalValue: creator.totalValue,
        avgPhysicalProgress:
          Math.round(creator.avgPhysicalProgress * 100) / 100,
        avgFinancialProgress:
          Math.round(creator.avgFinancialProgress * 100) / 100,
        completedProjects: creator.completedProjects,
        contractorCount: creator.contractorCount,
        completionRate:
          creator.projectCount > 0
            ? Math.round(
                (creator.completedProjects / creator.projectCount) * 100
              )
            : 0,
      })),

      typeOfWork: topTypeOfWork.map((type) => ({
        name: type._id,
        projectCount: type.projectCount,
        totalValue: type.totalValue,
        avgPhysicalProgress: Math.round(type.avgPhysicalProgress * 100) / 100,
        avgFinancialProgress: Math.round(type.avgFinancialProgress * 100) / 100,
        completedProjects: type.completedProjects,
        contractorCount: type.contractorCount,
        completionRate:
          type.projectCount > 0
            ? Math.round((type.completedProjects / type.projectCount) * 100)
            : 0,
      })),

      contractors: topContractors.map((contractor) => ({
        contractorName: contractor._id.contractorName,
        contractorPhone: contractor._id.contractorPhone,
        projectCount: contractor.projectCount,
        totalValue: contractor.totalValue,
        totalBillSubmitted: contractor.totalBillSubmitted,
        avgPhysicalProgress:
          Math.round(contractor.avgPhysicalProgress * 100) / 100,
        avgFinancialProgress:
          Math.round(contractor.avgFinancialProgress * 100) / 100,
        completedProjects: contractor.completedProjects,
        financiallyCompletedProjects: contractor.financiallyCompletedProjects,
        ongoingProjects: contractor.ongoingProjects,
        districtCount: contractor.districtCount,
        workTypeCount: contractor.workTypeCount,
        avgProjectValue: Math.round(contractor.avgProjectValue),
        budgetUtilization: Math.round(contractor.budgetUtilization * 100) / 100,
        physicalCompletionRate:
          contractor.projectCount > 0
            ? Math.round(
                (contractor.completedProjects / contractor.projectCount) * 100
              )
            : 0,
        financialCompletionRate:
          contractor.projectCount > 0
            ? Math.round(
                (contractor.financiallyCompletedProjects /
                  contractor.projectCount) *
                  100
              )
            : 0,
      })),
    };

    res.status(200).json({
      success: true,
      message: "Project summary retrieved successfully",
      data: {
        overview: {
          ...result,
          avgPhysicalProgress:
            Math.round(result.avgPhysicalProgress * 100) / 100,
          avgFinancialProgress:
            Math.round(result.avgFinancialProgress * 100) / 100,
          ...derivedMetrics,
        },
        distribution: {
          byPhysicalProgress: {
            notStarted: result.physicallyNotStartedProjects,
            inProgress: result.physicallyInProgressProjects,
            completed: result.physicallyCompletedProjects,
          },
          byFinancialProgress: {
            notStarted: result.financiallyNotStartedProjects,
            inProgress: result.financiallyInProgressProjects,
            completed: result.financiallyCompletedProjects,
          },
          byStatus: {
            submittedToAEE: result.submittedToAEE,
            submittedToCE: result.submittedToCE,
            submittedToMD: result.submittedToMD,
            approved: result.approvedProjects,
            ongoing: result.ongoingProjects,
            completed: result.completedStatusProjects,
            rejected: result.rejectedProjects,
            onHold: result.onHoldProjects,
          },
        },
        topPerformers: formattedTopData,
        progressMetrics: {
          totalUpdates:
            result.totalProgressUpdates + result.totalFinancialProgressUpdates,
          physicalUpdates: result.totalProgressUpdates,
          financialUpdates: result.totalFinancialProgressUpdates,
          avgUpdatesPerProject: derivedMetrics.avgUpdatesPerProject,
          avgProgressGap: Math.round(derivedMetrics.avgProgressGap * 100) / 100,
        },
        contractorMetrics: {
          totalUniqueContractors: result.totalUniqueContractors,
          avgProjectsPerContractor: derivedMetrics.avgProjectsPerContractor,
        },
      },
      filters: {
        status: status || null,
        district: district || null,
        fund: fund || null,
        createdBy: createdBy || null,
        typeOfWork: typeOfWork || null,
        contractorName: contractorName || null,
      },
      metadata: {
        generatedAt: new Date().toISOString(),
        dataFreshness: "real-time",
        totalProjectsAnalyzed: result.totalProjects,
        totalContractorsAnalyzed: result.totalUniqueContractors,
      },
    });
  } catch (error) {
    console.error("Error retrieving project summary:", error);
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

/**
 * Get district-wise project summary
 * GET /api/projects/summary/districts
 */
export const getDistrictWiseProjectsSummary = async (req, res) => {
  try {
    const { status, fund, timeRange, contractorName } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (fund) filter.fund = fund;
    if (contractorName) filter.contractorName = new RegExp(contractorName, "i");

    if (timeRange) {
      const endDate = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case "last30days":
          startDate.setDate(endDate.getDate() - 30);
          break;
        case "last3months":
          startDate.setMonth(endDate.getMonth() - 3);
          break;
        case "last6months":
          startDate.setMonth(endDate.getMonth() - 6);
          break;
        case "lastyear":
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          // No time filter applied
          break;
      }

      if (timeRange !== "all") {
        filter.createdAt = { $gte: startDate, $lte: endDate };
      }
    }

    const districtSummary = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$district",
          projectCount: { $sum: 1 },
          totalEstimatedCost: { $sum: "$estimatedCost" },
          totalBillSubmitted: { $sum: "$billSubmittedAmount" },
          avgPhysicalProgress: { $avg: "$progressPercentage" },
          avgFinancialProgress: { $avg: "$financialProgress" },
          completedProjects: {
            $sum: { $cond: [{ $eq: ["$progressPercentage", 100] }, 1, 0] },
          },
          financiallyCompletedProjects: {
            $sum: { $cond: [{ $eq: ["$financialProgress", 100] }, 1, 0] },
          },
          fullyCompletedProjects: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$progressPercentage", 100] },
                    { $eq: ["$financialProgress", 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          ongoingProjects: {
            $sum: { $cond: [{ $eq: ["$status", "Ongoing"] }, 1, 0] },
          },
          totalProgressUpdates: { $sum: { $size: "$progressUpdates" } },
          totalFinancialProgressUpdates: {
            $sum: { $size: "$financialProgressUpdates" },
          },
          uniqueContractors: { $addToSet: "$contractorName" },
          topContractors: {
            $push: {
              contractor: "$contractorName",
              phone: "$contractorPhoneNumber",
              estimatedCost: "$estimatedCost",
              physicalProgress: "$progressPercentage",
              financialProgress: "$financialProgress",
            },
          },
        },
      },
      {
        $addFields: {
          contractorCount: { $size: "$uniqueContractors" },
        },
      },
      { $sort: { projectCount: -1 } },
    ]);

    const formattedDistrictSummary = districtSummary.map((district) => ({
      districtName: district._id,
      projectCount: district.projectCount,
      totalEstimatedCost: district.totalEstimatedCost,
      totalBillSubmitted: district.totalBillSubmitted,
      remainingBudget:
        district.totalEstimatedCost - district.totalBillSubmitted,
      avgPhysicalProgress: Math.round(district.avgPhysicalProgress * 100) / 100,
      avgFinancialProgress:
        Math.round(district.avgFinancialProgress * 100) / 100,
      completedProjects: district.completedProjects,
      financiallyCompletedProjects: district.financiallyCompletedProjects,
      fullyCompletedProjects: district.fullyCompletedProjects,
      ongoingProjects: district.ongoingProjects,
      totalUpdates:
        district.totalProgressUpdates + district.totalFinancialProgressUpdates,
      contractorCount: district.contractorCount,
      uniqueContractors: district.uniqueContractors,

      // Calculated metrics
      physicalCompletionRate:
        district.projectCount > 0
          ? Math.round(
              (district.completedProjects / district.projectCount) * 100
            )
          : 0,
      financialCompletionRate:
        district.projectCount > 0
          ? Math.round(
              (district.financiallyCompletedProjects / district.projectCount) *
                100
            )
          : 0,
      fullCompletionRate:
        district.projectCount > 0
          ? Math.round(
              (district.fullyCompletedProjects / district.projectCount) * 100
            )
          : 0,
      budgetUtilizationRate:
        district.totalEstimatedCost > 0
          ? Math.round(
              (district.totalBillSubmitted / district.totalEstimatedCost) * 100
            )
          : 0,
      avgProjectValue:
        district.projectCount > 0
          ? Math.round(district.totalEstimatedCost / district.projectCount)
          : 0,
      progressGap: Math.abs(
        district.avgPhysicalProgress - district.avgFinancialProgress
      ),
      avgProjectsPerContractor:
        district.contractorCount > 0
          ? Math.round(
              (district.projectCount / district.contractorCount) * 100
            ) / 100
          : 0,
    }));

    res.status(200).json({
      success: true,
      message: "District-wise project summary retrieved successfully",
      data: {
        districts: formattedDistrictSummary,
        totalDistricts: formattedDistrictSummary.length,
        aggregatedTotals: {
          totalProjects: formattedDistrictSummary.reduce(
            (sum, d) => sum + d.projectCount,
            0
          ),
          totalEstimatedCost: formattedDistrictSummary.reduce(
            (sum, d) => sum + d.totalEstimatedCost,
            0
          ),
          totalBillSubmitted: formattedDistrictSummary.reduce(
            (sum, d) => sum + d.totalBillSubmitted,
            0
          ),
          totalCompletedProjects: formattedDistrictSummary.reduce(
            (sum, d) => sum + d.completedProjects,
            0
          ),
          totalOngoingProjects: formattedDistrictSummary.reduce(
            (sum, d) => sum + d.ongoingProjects,
            0
          ),
          totalUniqueContractors: [
            ...new Set(
              formattedDistrictSummary.flatMap((d) => d.uniqueContractors)
            ),
          ].length,
          totalContractorCount: formattedDistrictSummary.reduce(
            (sum, d) => sum + d.contractorCount,
            0
          ),
        },
      },
      filters: {
        status: status || null,
        fund: fund || null,
        timeRange: timeRange || "all",
        contractorName: contractorName || null,
      },
    });
  } catch (error) {
    console.error("Error retrieving district-wise project summary:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving district-wise summary",
    });
  }
};

/**
 * Get contractor-wise project summary
 * GET /api/projects/summary/contractors
 */
export const getContractorWiseProjectsSummary = async (req, res) => {
  try {
    const { status, district, fund, timeRange } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (district) filter.district = district;
    if (fund) filter.fund = fund;

    if (timeRange) {
      const endDate = new Date();
      const startDate = new Date();

      switch (timeRange) {
        case "last30days":
          startDate.setDate(endDate.getDate() - 30);
          break;
        case "last3months":
          startDate.setMonth(endDate.getMonth() - 3);
          break;
        case "last6months":
          startDate.setMonth(endDate.getMonth() - 6);
          break;
        case "lastyear":
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
        default:
          break;
      }

      if (timeRange !== "all") {
        filter.createdAt = { $gte: startDate, $lte: endDate };
      }
    }

    const contractorSummary = await Project.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            contractorName: "$contractorName",
            contractorPhone: "$contractorPhoneNumber",
            contractorAddress: "$contractorAddress",
          },
          projectCount: { $sum: 1 },
          totalEstimatedCost: { $sum: "$estimatedCost" },
          totalBillSubmitted: { $sum: "$billSubmittedAmount" },
          avgPhysicalProgress: { $avg: "$progressPercentage" },
          avgFinancialProgress: { $avg: "$financialProgress" },
          completedProjects: {
            $sum: { $cond: [{ $eq: ["$progressPercentage", 100] }, 1, 0] },
          },
          financiallyCompletedProjects: {
            $sum: { $cond: [{ $eq: ["$financialProgress", 100] }, 1, 0] },
          },
          fullyCompletedProjects: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$progressPercentage", 100] },
                    { $eq: ["$financialProgress", 100] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          ongoingProjects: {
            $sum: { $cond: [{ $eq: ["$status", "Ongoing"] }, 1, 0] },
          },
          districts: { $addToSet: "$district" },
          workTypes: { $addToSet: "$typeOfWork" },
          funds: { $addToSet: "$fund" },
          totalProgressUpdates: { $sum: { $size: "$progressUpdates" } },
          totalFinancialProgressUpdates: {
            $sum: { $size: "$financialProgressUpdates" },
          },
        },
      },
      {
        $addFields: {
          districtCount: { $size: "$districts" },
          workTypeCount: { $size: "$workTypes" },
          fundCount: { $size: "$funds" },
        },
      },
      { $sort: { projectCount: -1 } },
    ]);

    const formattedContractorSummary = contractorSummary.map((contractor) => ({
      contractorName: contractor._id.contractorName,
      contractorPhone: contractor._id.contractorPhone,
      contractorAddress: contractor._id.contractorAddress,
      projectCount: contractor.projectCount,
      totalEstimatedCost: contractor.totalEstimatedCost,
      totalBillSubmitted: contractor.totalBillSubmitted,
      remainingBudget:
        contractor.totalEstimatedCost - contractor.totalBillSubmitted,
      avgPhysicalProgress:
        Math.round(contractor.avgPhysicalProgress * 100) / 100,
      avgFinancialProgress:
        Math.round(contractor.avgFinancialProgress * 100) / 100,
      completedProjects: contractor.completedProjects,
      financiallyCompletedProjects: contractor.financiallyCompletedProjects,
      fullyCompletedProjects: contractor.fullyCompletedProjects,
      ongoingProjects: contractor.ongoingProjects,
      districts: contractor.districts,
      workTypes: contractor.workTypes,
      funds: contractor.funds,
      districtCount: contractor.districtCount,
      workTypeCount: contractor.workTypeCount,
      fundCount: contractor.fundCount,
      totalUpdates:
        contractor.totalProgressUpdates +
        contractor.totalFinancialProgressUpdates,

      // Calculated metrics
      physicalCompletionRate:
        contractor.projectCount > 0
          ? Math.round(
              (contractor.completedProjects / contractor.projectCount) * 100
            )
          : 0,
      financialCompletionRate:
        contractor.projectCount > 0
          ? Math.round(
              (contractor.financiallyCompletedProjects /
                contractor.projectCount) *
                100
            )
          : 0,
      fullCompletionRate:
        contractor.projectCount > 0
          ? Math.round(
              (contractor.fullyCompletedProjects / contractor.projectCount) *
                100
            )
          : 0,
      budgetUtilizationRate:
        contractor.totalEstimatedCost > 0
          ? Math.round(
              (contractor.totalBillSubmitted / contractor.totalEstimatedCost) *
                100
            )
          : 0,
      avgProjectValue:
        contractor.projectCount > 0
          ? Math.round(contractor.totalEstimatedCost / contractor.projectCount)
          : 0,
      progressGap: Math.abs(
        contractor.avgPhysicalProgress - contractor.avgFinancialProgress
      ),
      diversityScore:
        contractor.districtCount +
        contractor.workTypeCount +
        contractor.fundCount,
    }));

    res.status(200).json({
      success: true,
      message: "Contractor-wise project summary retrieved successfully",
      data: {
        contractors: formattedContractorSummary,
        totalContractors: formattedContractorSummary.length,
        aggregatedTotals: {
          totalProjects: formattedContractorSummary.reduce(
            (sum, c) => sum + c.projectCount,
            0
          ),
          totalEstimatedCost: formattedContractorSummary.reduce(
            (sum, c) => sum + c.totalEstimatedCost,
            0
          ),
          totalBillSubmitted: formattedContractorSummary.reduce(
            (sum, c) => sum + c.totalBillSubmitted,
            0
          ),
          totalCompletedProjects: formattedContractorSummary.reduce(
            (sum, c) => sum + c.completedProjects,
            0
          ),
          totalOngoingProjects: formattedContractorSummary.reduce(
            (sum, c) => sum + c.ongoingProjects,
            0
          ),
        },
      },
      filters: {
        status: status || null,
        district: district || null,
        fund: fund || null,
        timeRange: timeRange || "all",
      },
    });
  } catch (error) {
    console.error("Error retrieving contractor-wise project summary:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving contractor-wise summary",
    });
  }
};

export default {
  getProjectsSummary,
  getDistrictWiseProjectsSummary,
  getContractorWiseProjectsSummary,
};
