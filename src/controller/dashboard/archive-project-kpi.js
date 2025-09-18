import ArchiveProject from "../../models/archive-project.model.js";

/**
 * Get archive projects KPIs for dashboard comparison
 * GET /api/dashboard/archive-kpis
 */
export const getArchiveKPIs = async (req, res) => {
  try {
    const { userRole, userId } = req.user;
    const { timeRange = "365", financialYear } = req.query;

    // Build filter based on user role
    const userFilter = {};
    if (userRole === "JE") {
      userFilter["createdBy.userId"] = userId;
    }

    // Add financial year filter if provided
    if (financialYear) {
      userFilter.financialYear = financialYear;
    }

    // Calculate date range
    const now = new Date();
    const daysBack = Math.min(parseInt(timeRange), 1095); // Max 3 years
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    if (!financialYear) {
      userFilter.createdAt = { $gte: startDate };
    }

    // Get archive project KPIs
    const [
      archiveOverview,
      archiveFinancials,
      archiveProgress,
      archiveQueries,
    ] = await Promise.all([
      // Archive project overview
      ArchiveProject.aggregate([
        { $match: userFilter },
        {
          $group: {
            _id: null,
            totalArchiveProjects: { $sum: 1 },
            totalWorkValue: { $sum: "$workValue" },
            totalAAAmount: { $sum: "$AAAmount" },
            avgWorkValue: { $avg: "$workValue" },
            maxWorkValue: { $max: "$workValue" },
            minWorkValue: { $min: "$workValue" },

            // Progress distribution
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

            // Financial progress distribution
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

            // Fully completed projects (both physical and financial)
            fullyCompletedProjects: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$progress", 100] },
                      { $eq: ["$financialProgress", 100] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            // Location and contractor statistics
            uniqueLocations: { $addToSet: "$location" },
            uniqueContractors: { $addToSet: "$nameOfContractor" },
            uniqueEngineers: { $addToSet: "$concernedEngineer" },

            // Financial years covered
            financialYears: { $addToSet: "$financialYear" },
          },
        },
        {
          $addFields: {
            uniqueLocationCount: { $size: "$uniqueLocations" },
            uniqueContractorCount: { $size: "$uniqueContractors" },
            uniqueEngineerCount: { $size: "$uniqueEngineers" },
            financialYearCount: { $size: "$financialYears" },
          },
        },
      ]),

      // Archive financial metrics
      ArchiveProject.aggregate([
        { $match: userFilter },
        {
          $group: {
            _id: null,
            totalBillSubmitted: { $sum: "$billSubmittedAmount" },
            avgPhysicalProgress: { $avg: "$progress" },
            avgFinancialProgress: { $avg: "$financialProgress" },

            // Budget vs actual analysis
            budgetEfficiencyProjects: {
              $sum: {
                $cond: [{ $lte: ["$billSubmittedAmount", "$workValue"] }, 1, 0],
              },
            },
            overBudgetProjects: {
              $sum: {
                $cond: [{ $gt: ["$billSubmittedAmount", "$workValue"] }, 1, 0],
              },
            },

            // High-performing projects
            highPerformingProjects: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$progress", 90] },
                      { $gte: ["$financialProgress", 90] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },

            totalProjects: { $sum: 1 },
          },
        },
      ]),

      // Archive progress update statistics
      ArchiveProject.aggregate([
        { $match: userFilter },
        {
          $group: {
            _id: null,
            totalProgressUpdates: { $sum: { $size: "$progressUpdates" } },
            totalFinancialUpdates: {
              $sum: { $size: "$financialProgressUpdates" },
            },

            // Projects with updates
            projectsWithProgressUpdates: {
              $sum: {
                $cond: [{ $gt: [{ $size: "$progressUpdates" }, 0] }, 1, 0],
              },
            },
            projectsWithFinancialUpdates: {
              $sum: {
                $cond: [
                  { $gt: [{ $size: "$financialProgressUpdates" }, 0] },
                  1,
                  0,
                ],
              },
            },

            // Last update tracking
            recentProgressUpdates: {
              $sum: {
                $cond: [{ $gte: ["$lastProgressUpdate", startDate] }, 1, 0],
              },
            },
            recentFinancialUpdates: {
              $sum: {
                $cond: [
                  { $gte: ["$lastFinancialProgressUpdate", startDate] },
                  1,
                  0,
                ],
              },
            },

            totalProjects: { $sum: 1 },
          },
        },
      ]),

      // Archive query statistics
      ArchiveProject.aggregate([
        { $match: userFilter },
        { $unwind: { path: "$queries", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: null,
            totalQueries: {
              $sum: { $cond: [{ $ne: ["$queries", null] }, 1, 0] },
            },
            resolvedQueries: {
              $sum: {
                $cond: [
                  { $in: ["$queries.status", ["Resolved", "Closed"]] },
                  1,
                  0,
                ],
              },
            },
            escalatedQueries: {
              $sum: {
                $cond: [{ $gt: ["$queries.escalationLevel", 0] }, 1, 0],
              },
            },
            urgentQueries: {
              $sum: {
                $cond: [{ $eq: ["$queries.priority", "Urgent"] }, 1, 0],
              },
            },
            projectsWithQueries: {
              $addToSet: {
                $cond: [{ $ne: ["$queries", null] }, "$_id", null],
              },
            },
          },
        },
        {
          $project: {
            totalQueries: 1,
            resolvedQueries: 1,
            escalatedQueries: 1,
            urgentQueries: 1,
            projectsWithQueries: {
              $size: {
                $filter: {
                  input: "$projectsWithQueries",
                  cond: { $ne: ["$$this", null] },
                },
              },
            },
          },
        },
      ]),
    ]);

    // Extract results
    const overview = archiveOverview[0] || {};
    const financials = archiveFinancials[0] || {};
    const progress = archiveProgress[0] || {};
    const queries = archiveQueries[0] || {};

    // Calculate performance metrics
    const performanceMetrics = {
      completionRate:
        overview.totalArchiveProjects > 0
          ? Math.round(
              (overview.completedProjects / overview.totalArchiveProjects) * 100
            )
          : 0,

      financialCompletionRate:
        overview.totalArchiveProjects > 0
          ? Math.round(
              (overview.financiallyCompletedProjects /
                overview.totalArchiveProjects) *
                100
            )
          : 0,

      fullCompletionRate:
        overview.totalArchiveProjects > 0
          ? Math.round(
              (overview.fullyCompletedProjects /
                overview.totalArchiveProjects) *
                100
            )
          : 0,

      budgetEfficiencyRate:
        financials.totalProjects > 0
          ? Math.round(
              (financials.budgetEfficiencyProjects / financials.totalProjects) *
                100
            )
          : 0,

      highPerformanceRate:
        financials.totalProjects > 0
          ? Math.round(
              (financials.highPerformingProjects / financials.totalProjects) *
                100
            )
          : 0,

      queryResolutionRate:
        queries.totalQueries > 0
          ? Math.round((queries.resolvedQueries / queries.totalQueries) * 100)
          : 0,

      updateActivityRate:
        progress.totalProjects > 0
          ? Math.round(
              ((progress.projectsWithProgressUpdates +
                progress.projectsWithFinancialUpdates) /
                (progress.totalProjects * 2)) *
                100
            )
          : 0,
    };

    // Get top performers
    const topPerformers = await ArchiveProject.aggregate([
      { $match: userFilter },
      {
        $group: {
          _id: {
            location: "$location",
            engineer: "$concernedEngineer",
            contractor: "$nameOfContractor",
          },
          projectCount: { $sum: 1 },
          totalValue: { $sum: "$workValue" },
          avgProgress: { $avg: "$progress" },
          avgFinancialProgress: { $avg: "$financialProgress" },
          completedCount: {
            $sum: { $cond: [{ $eq: ["$progress", 100] }, 1, 0] },
          },
        },
      },
      {
        $project: {
          location: "$_id.location",
          engineer: "$_id.engineer",
          contractor: "$_id.contractor",
          projectCount: 1,
          totalValue: 1,
          avgProgress: { $round: ["$avgProgress", 2] },
          avgFinancialProgress: { $round: ["$avgFinancialProgress", 2] },
          completionRate: {
            $round: [
              {
                $multiply: [
                  { $divide: ["$completedCount", "$projectCount"] },
                  100,
                ],
              },
              2,
            ],
          },
        },
      },
      { $sort: { completionRate: -1, projectCount: -1 } },
      { $limit: 10 },
    ]);

    // Historical trends by financial year
    const yearlyTrends = await ArchiveProject.aggregate([
      { $match: userFilter },
      {
        $group: {
          _id: "$financialYear",
          projectCount: { $sum: 1 },
          totalValue: { $sum: "$workValue" },
          avgProgress: { $avg: "$progress" },
          avgFinancialProgress: { $avg: "$financialProgress" },
          completedProjects: {
            $sum: { $cond: [{ $eq: ["$progress", 100] }, 1, 0] },
          },
          totalQueries: { $sum: { $size: "$queries" } },
        },
      },
      {
        $project: {
          financialYear: "$_id",
          projectCount: 1,
          totalValue: 1,
          avgProgress: { $round: ["$avgProgress", 2] },
          avgFinancialProgress: { $round: ["$avgFinancialProgress", 2] },
          completionRate: {
            $round: [
              {
                $multiply: [
                  { $divide: ["$completedProjects", "$projectCount"] },
                  100,
                ],
              },
              2,
            ],
          },
          avgQueriesPerProject: {
            $round: [{ $divide: ["$totalQueries", "$projectCount"] }, 2],
          },
        },
      },
      { $sort: { financialYear: -1 } },
    ]);

    const response = {
      success: true,
      message: "Archive projects KPIs retrieved successfully",
      data: {
        overview: {
          totalProjects: overview.totalArchiveProjects || 0,
          totalWorkValue: overview.totalWorkValue || 0,
          totalAAAmount: overview.totalAAAmount || 0,
          avgWorkValue: Math.round(overview.avgWorkValue || 0),
          maxWorkValue: overview.maxWorkValue || 0,
          minWorkValue: overview.minWorkValue || 0,
          uniqueLocations: overview.uniqueLocationCount || 0,
          uniqueContractors: overview.uniqueContractorCount || 0,
          uniqueEngineers: overview.uniqueEngineerCount || 0,
          financialYearsCovered: overview.financialYearCount || 0,
        },

        progressDistribution: {
          physical: {
            completed: overview.completedProjects || 0,
            inProgress: overview.inProgressProjects || 0,
            notStarted: overview.notStartedProjects || 0,
          },
          financial: {
            completed: overview.financiallyCompletedProjects || 0,
            inProgress: overview.financiallyInProgressProjects || 0,
            notStarted: overview.financiallyNotStartedProjects || 0,
          },
          fullyCompleted: overview.fullyCompletedProjects || 0,
        },

        financialMetrics: {
          totalBillSubmitted: financials.totalBillSubmitted || 0,
          avgPhysicalProgress:
            Math.round((financials.avgPhysicalProgress || 0) * 100) / 100,
          avgFinancialProgress:
            Math.round((financials.avgFinancialProgress || 0) * 100) / 100,
          budgetEfficiencyProjects: financials.budgetEfficiencyProjects || 0,
          overBudgetProjects: financials.overBudgetProjects || 0,
          highPerformingProjects: financials.highPerformingProjects || 0,
          remainingValue:
            (overview.totalWorkValue || 0) -
            (financials.totalBillSubmitted || 0),
        },

        updateStatistics: {
          totalProgressUpdates: progress.totalProgressUpdates || 0,
          totalFinancialUpdates: progress.totalFinancialUpdates || 0,
          projectsWithProgressUpdates:
            progress.projectsWithProgressUpdates || 0,
          projectsWithFinancialUpdates:
            progress.projectsWithFinancialUpdates || 0,
          recentProgressUpdates: progress.recentProgressUpdates || 0,
          recentFinancialUpdates: progress.recentFinancialUpdates || 0,
          avgUpdatesPerProject:
            progress.totalProjects > 0
              ? Math.round(
                  (((progress.totalProgressUpdates || 0) +
                    (progress.totalFinancialUpdates || 0)) /
                    progress.totalProjects) *
                    100
                ) / 100
              : 0,
        },

        queryStatistics: {
          totalQueries: queries.totalQueries || 0,
          resolvedQueries: queries.resolvedQueries || 0,
          escalatedQueries: queries.escalatedQueries || 0,
          urgentQueries: queries.urgentQueries || 0,
          projectsWithQueries: queries.projectsWithQueries || 0,
          avgQueriesPerProject:
            (queries.projectsWithQueries || 0) > 0
              ? Math.round(
                  ((queries.totalQueries || 0) / queries.projectsWithQueries) *
                    100
                ) / 100
              : 0,
        },

        performanceMetrics,

        topPerformers: {
          byLocation: topPerformers.reduce((acc, item) => {
            if (!acc[item.location]) {
              acc[item.location] = {
                location: item.location,
                projectCount: 0,
                totalValue: 0,
                avgCompletionRate: 0,
                projects: [],
              };
            }
            acc[item.location].projectCount += item.projectCount;
            acc[item.location].totalValue += item.totalValue;
            acc[item.location].projects.push(item);
            return acc;
          }, {}),

          byEngineer: topPerformers.reduce((acc, item) => {
            if (!acc[item.engineer]) {
              acc[item.engineer] = {
                engineer: item.engineer,
                projectCount: 0,
                totalValue: 0,
                avgCompletionRate: 0,
              };
            }
            acc[item.engineer].projectCount += item.projectCount;
            acc[item.engineer].totalValue += item.totalValue;
            acc[item.engineer].avgCompletionRate =
              (acc[item.engineer].avgCompletionRate + item.completionRate) / 2;
            return acc;
          }, {}),

          byContractor: topPerformers.reduce((acc, item) => {
            if (!acc[item.contractor]) {
              acc[item.contractor] = {
                contractor: item.contractor,
                projectCount: 0,
                totalValue: 0,
                avgCompletionRate: 0,
              };
            }
            acc[item.contractor].projectCount += item.projectCount;
            acc[item.contractor].totalValue += item.totalValue;
            acc[item.contractor].avgCompletionRate =
              (acc[item.contractor].avgCompletionRate + item.completionRate) /
              2;
            return acc;
          }, {}),
        },

        historicalTrends: yearlyTrends,

        insights: {
          bestPerformingYear:
            yearlyTrends.length > 0
              ? yearlyTrends.reduce((best, current) =>
                  current.completionRate > best.completionRate ? current : best
                )
              : null,

          performanceTrend: calculatePerformanceTrend(yearlyTrends),

          budgetEfficiency:
            performanceMetrics.budgetEfficiencyRate > 80
              ? "Excellent"
              : performanceMetrics.budgetEfficiencyRate > 60
              ? "Good"
              : performanceMetrics.budgetEfficiencyRate > 40
              ? "Average"
              : "Needs Improvement",

          queryManagement:
            performanceMetrics.queryResolutionRate > 80
              ? "Excellent"
              : performanceMetrics.queryResolutionRate > 60
              ? "Good"
              : performanceMetrics.queryResolutionRate > 40
              ? "Average"
              : "Needs Improvement",

          overallGrade: calculateOverallGrade(performanceMetrics),
        },
      },
      metadata: {
        userRole,
        timeRange: `${daysBack} days`,
        financialYear: financialYear || "All years",
        generatedAt: new Date().toISOString(),
        dataFreshness: "historical",
        totalProjectsAnalyzed: overview.totalArchiveProjects || 0,
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error retrieving archive KPIs:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving archive KPIs",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get archive vs active comparison
 * GET /api/dashboard/archive-comparison
 */
export const getArchiveComparison = async (req, res) => {
  try {
    const { userRole, userId } = req.user;

    // Build filter based on user role
    const userFilter = {};
    if (userRole === "JE") {
      userFilter["createdBy.userId"] = userId;
    }

    // Get current year's projects (both active and archive)
    const currentYear = new Date().getFullYear();
    const currentFinancialYear = `${currentYear}-${currentYear + 1}`;

    const Project = (await import("../../models/project.model.js")).default;

    const [activeProjects, archiveProjects] = await Promise.all([
      // Active projects
      Project.aggregate([
        { $match: userFilter },
        {
          $group: {
            _id: null,
            totalProjects: { $sum: 1 },
            totalValue: { $sum: "$estimatedCost" },
            avgPhysicalProgress: { $avg: "$progressPercentage" },
            avgFinancialProgress: { $avg: "$financialProgress" },
            completedProjects: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
            },
            ongoingProjects: {
              $sum: { $cond: [{ $eq: ["$status", "Ongoing"] }, 1, 0] },
            },
            totalQueries: { $sum: { $size: "$queries" } },
          },
        },
      ]),

      // Archive projects
      ArchiveProject.aggregate([
        { $match: userFilter },
        {
          $group: {
            _id: null,
            totalProjects: { $sum: 1 },
            totalValue: { $sum: "$workValue" },
            avgPhysicalProgress: { $avg: "$progress" },
            avgFinancialProgress: { $avg: "$financialProgress" },
            completedProjects: {
              $sum: { $cond: [{ $eq: ["$progress", 100] }, 1, 0] },
            },
            totalQueries: { $sum: { $size: "$queries" } },
          },
        },
      ]),
    ]);

    const active = activeProjects[0] || {};
    const archive = archiveProjects[0] || {};

    // Calculate comparison metrics
    const comparison = {
      projectCount: {
        active: active.totalProjects || 0,
        archive: archive.totalProjects || 0,
        total: (active.totalProjects || 0) + (archive.totalProjects || 0),
        archivePercentage:
          (archive.totalProjects || 0) + (active.totalProjects || 0) > 0
            ? Math.round(
                ((archive.totalProjects || 0) /
                  ((archive.totalProjects || 0) +
                    (active.totalProjects || 0))) *
                  100
              )
            : 0,
      },

      projectValue: {
        active: active.totalValue || 0,
        archive: archive.totalValue || 0,
        total: (active.totalValue || 0) + (archive.totalValue || 0),
        archivePercentage:
          (archive.totalValue || 0) + (active.totalValue || 0) > 0
            ? Math.round(
                ((archive.totalValue || 0) /
                  ((archive.totalValue || 0) + (active.totalValue || 0))) *
                  100
              )
            : 0,
      },

      avgProgress: {
        activePhysical:
          Math.round((active.avgPhysicalProgress || 0) * 100) / 100,
        archivePhysical:
          Math.round((archive.avgPhysicalProgress || 0) * 100) / 100,
        activeFinancial:
          Math.round((active.avgFinancialProgress || 0) * 100) / 100,
        archiveFinancial:
          Math.round((archive.avgFinancialProgress || 0) * 100) / 100,
        improvementPhysical:
          Math.round(
            ((active.avgPhysicalProgress || 0) -
              (archive.avgPhysicalProgress || 0)) *
              100
          ) / 100,
        improvementFinancial:
          Math.round(
            ((active.avgFinancialProgress || 0) -
              (archive.avgFinancialProgress || 0)) *
              100
          ) / 100,
      },

      completionRate: {
        active:
          active.totalProjects > 0
            ? Math.round(
                (active.completedProjects / active.totalProjects) * 100
              )
            : 0,
        archive:
          archive.totalProjects > 0
            ? Math.round(
                (archive.completedProjects / archive.totalProjects) * 100
              )
            : 0,
      },

      queryActivity: {
        active: active.totalQueries || 0,
        archive: archive.totalQueries || 0,
        avgPerProjectActive:
          active.totalProjects > 0
            ? Math.round((active.totalQueries / active.totalProjects) * 100) /
              100
            : 0,
        avgPerProjectArchive:
          archive.totalProjects > 0
            ? Math.round((archive.totalQueries / archive.totalProjects) * 100) /
              100
            : 0,
      },
    };

    res.status(200).json({
      success: true,
      message: "Archive comparison retrieved successfully",
      data: {
        comparison,
        insights: {
          archiveContribution: `Archive projects represent ${comparison.projectCount.archivePercentage}% of total project portfolio`,
          progressTrend:
            comparison.avgProgress.improvementPhysical > 0
              ? "Physical progress improving in active projects"
              : "Physical progress declining in active projects",
          financialTrend:
            comparison.avgProgress.improvementFinancial > 0
              ? "Financial progress improving in active projects"
              : "Financial progress declining in active projects",
          completionTrend:
            comparison.completionRate.active > comparison.completionRate.archive
              ? "Current completion rate is better than historical"
              : "Historical completion rate was better",
          queryTrend:
            comparison.queryActivity.avgPerProjectActive >
            comparison.queryActivity.avgPerProjectArchive
              ? "More queries per project in active portfolio"
              : "Fewer queries per project compared to archive",
        },
        recommendations: generateRecommendations(comparison),
      },
      metadata: {
        userRole,
        generatedAt: new Date().toISOString(),
        activeProjectsCount: active.totalProjects || 0,
        archiveProjectsCount: archive.totalProjects || 0,
      },
    });
  } catch (error) {
    console.error("Error retrieving archive comparison:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving archive comparison",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Helper functions
function calculatePerformanceTrend(yearlyTrends) {
  if (yearlyTrends.length < 2) return "Insufficient data";

  const recent = yearlyTrends.slice(0, 2);
  const older = yearlyTrends.slice(-2);

  const recentAvg =
    recent.reduce((sum, year) => sum + year.completionRate, 0) / recent.length;
  const olderAvg =
    older.reduce((sum, year) => sum + year.completionRate, 0) / older.length;

  const improvement = recentAvg - olderAvg;

  if (improvement > 5) return "Improving";
  if (improvement < -5) return "Declining";
  return "Stable";
}

function calculateOverallGrade(metrics) {
  const weights = {
    completionRate: 0.3,
    financialCompletionRate: 0.25,
    budgetEfficiencyRate: 0.2,
    queryResolutionRate: 0.15,
    highPerformanceRate: 0.1,
  };

  const weightedScore = Object.entries(weights).reduce(
    (sum, [metric, weight]) => {
      return sum + (metrics[metric] || 0) * weight;
    },
    0
  );

  if (weightedScore >= 90) return "A";
  if (weightedScore >= 80) return "B";
  if (weightedScore >= 70) return "C";
  if (weightedScore >= 60) return "D";
  return "F";
}

function generateRecommendations(comparison) {
  const recommendations = [];

  if (comparison.completionRate.active < comparison.completionRate.archive) {
    recommendations.push(
      "Focus on improving project completion rates - historical performance was better"
    );
  }

  if (comparison.avgProgress.improvementPhysical < 0) {
    recommendations.push(
      "Physical progress tracking needs improvement compared to archive projects"
    );
  }

  if (comparison.avgProgress.improvementFinancial < 0) {
    recommendations.push(
      "Financial progress management needs attention - archive projects performed better"
    );
  }

  if (
    comparison.queryActivity.avgPerProjectActive >
    comparison.queryActivity.avgPerProjectArchive * 1.5
  ) {
    recommendations.push(
      "High query volume in active projects - consider process improvements"
    );
  }

  if (recommendations.length === 0) {
    recommendations.push(
      "Current performance is on par with or better than historical performance"
    );
  }

  return recommendations;
}

export default {
  getArchiveKPIs,
  getArchiveComparison,
};
