import ArchiveProject from "../../models/archive-project.model.js";
import Project from "../../models/project.model.js";

/**
 * Get query management KPIs for dashboard
 * GET /api/dashboard/query-kpis
 */
export const getQueryKPIs = async (req, res) => {
  try {
    const { userRole, userId } = req.user;
    const { includeArchive = false, timeRange = "30" } = req.query;

    // Calculate date range
    const now = new Date();
    const daysBack = Math.min(parseInt(timeRange), 365); // Max 1 year
    const startDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);

    // Build filter based on user role
    const userFilter = {};
    if (userRole === "JE") {
      userFilter["createdBy.userId"] = userId;
    }

    // Query KPIs from active projects
    const queryStats = await Project.aggregate([
      { $match: userFilter },
      { $unwind: { path: "$queries", preserveNullAndEmptyArrays: true } },
      {
        $match: {
          $or: [
            { queries: { $exists: false } }, // Projects with no queries
            { "queries.isActive": true }, // Projects with active queries
          ],
        },
      },
      {
        $group: {
          _id: null,
          totalProjects: { $addToSet: "$_id" },
          totalQueries: {
            $sum: { $cond: [{ $ne: ["$queries", null] }, 1, 0] },
          },

          // Query status distribution
          openQueries: {
            $sum: { $cond: [{ $eq: ["$queries.status", "Open"] }, 1, 0] },
          },
          inProgressQueries: {
            $sum: {
              $cond: [{ $eq: ["$queries.status", "In Progress"] }, 1, 0],
            },
          },
          underReviewQueries: {
            $sum: {
              $cond: [{ $eq: ["$queries.status", "Under Review"] }, 1, 0],
            },
          },
          resolvedQueries: {
            $sum: { $cond: [{ $eq: ["$queries.status", "Resolved"] }, 1, 0] },
          },
          closedQueries: {
            $sum: { $cond: [{ $eq: ["$queries.status", "Closed"] }, 1, 0] },
          },
          escalatedQueries: {
            $sum: { $cond: [{ $eq: ["$queries.status", "Escalated"] }, 1, 0] },
          },

          // Priority distribution
          urgentQueries: {
            $sum: { $cond: [{ $eq: ["$queries.priority", "Urgent"] }, 1, 0] },
          },
          highPriorityQueries: {
            $sum: { $cond: [{ $eq: ["$queries.priority", "High"] }, 1, 0] },
          },
          mediumPriorityQueries: {
            $sum: { $cond: [{ $eq: ["$queries.priority", "Medium"] }, 1, 0] },
          },
          lowPriorityQueries: {
            $sum: { $cond: [{ $eq: ["$queries.priority", "Low"] }, 1, 0] },
          },

          // Category distribution
          technicalQueries: {
            $sum: {
              $cond: [{ $eq: ["$queries.queryCategory", "Technical"] }, 1, 0],
            },
          },
          financialQueries: {
            $sum: {
              $cond: [{ $eq: ["$queries.queryCategory", "Financial"] }, 1, 0],
            },
          },
          administrativeQueries: {
            $sum: {
              $cond: [
                { $eq: ["$queries.queryCategory", "Administrative"] },
                1,
                0,
              ],
            },
          },
          legalQueries: {
            $sum: {
              $cond: [{ $eq: ["$queries.queryCategory", "Legal"] }, 1, 0],
            },
          },
          complianceQueries: {
            $sum: {
              $cond: [{ $eq: ["$queries.queryCategory", "Compliance"] }, 1, 0],
            },
          },
          otherQueries: {
            $sum: {
              $cond: [{ $eq: ["$queries.queryCategory", "Other"] }, 1, 0],
            },
          },

          // Time-based metrics
          overdueQueries: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$queries", null] },
                    { $lt: ["$queries.expectedResolutionDate", now] },
                    { $nin: ["$queries.status", ["Resolved", "Closed"]] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          recentQueries: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$queries", null] },
                    { $gte: ["$queries.raisedDate", startDate] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          resolvedRecentQueries: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$queries", null] },
                    { $in: ["$queries.status", ["Resolved", "Closed"]] },
                    { $gte: ["$queries.actualResolutionDate", startDate] },
                  ],
                },
                1,
                0,
              ],
            },
          },

          // Escalation metrics
          level1Escalations: {
            $sum: { $cond: [{ $eq: ["$queries.escalationLevel", 1] }, 1, 0] },
          },
          level2Escalations: {
            $sum: { $cond: [{ $eq: ["$queries.escalationLevel", 2] }, 1, 0] },
          },
          level3PlusEscalations: {
            $sum: { $cond: [{ $gte: ["$queries.escalationLevel", 3] }, 1, 0] },
          },

          // Resolution time metrics (for resolved queries)
          resolvedQueriesWithDates: {
            $push: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$queries", null] },
                    { $in: ["$queries.status", ["Resolved", "Closed"]] },
                    { $ne: ["$queries.actualResolutionDate", null] },
                    { $ne: ["$queries.raisedDate", null] },
                  ],
                },
                {
                  resolutionDays: {
                    $divide: [
                      {
                        $subtract: [
                          "$queries.actualResolutionDate",
                          "$queries.raisedDate",
                        ],
                      },
                      86400000,
                    ],
                  },
                },
                null,
              ],
            },
          },

          // Projects with queries
          projectsWithQueries: {
            $addToSet: {
              $cond: [{ $ne: ["$queries", null] }, "$_id", null],
            },
          },
        },
      },
      {
        $project: {
          totalProjects: { $size: "$totalProjects" },
          totalQueries: 1,
          statusDistribution: {
            open: "$openQueries",
            inProgress: "$inProgressQueries",
            underReview: "$underReviewQueries",
            resolved: "$resolvedQueries",
            closed: "$closedQueries",
            escalated: "$escalatedQueries",
          },
          priorityDistribution: {
            urgent: "$urgentQueries",
            high: "$highPriorityQueries",
            medium: "$mediumPriorityQueries",
            low: "$lowPriorityQueries",
          },
          categoryDistribution: {
            technical: "$technicalQueries",
            financial: "$financialQueries",
            administrative: "$administrativeQueries",
            legal: "$legalQueries",
            compliance: "$complianceQueries",
            other: "$otherQueries",
          },
          timeMetrics: {
            overdue: "$overdueQueries",
            recent: "$recentQueries",
            resolvedRecent: "$resolvedRecentQueries",
          },
          escalationMetrics: {
            level1: "$level1Escalations",
            level2: "$level2Escalations",
            level3Plus: "$level3PlusEscalations",
            total: {
              $add: [
                "$level1Escalations",
                "$level2Escalations",
                "$level3PlusEscalations",
              ],
            },
          },
          projectsWithQueries: {
            $size: {
              $filter: {
                input: "$projectsWithQueries",
                cond: { $ne: ["$$this", null] },
              },
            },
          },
          resolvedQueriesData: {
            $filter: {
              input: "$resolvedQueriesWithDates",
              cond: { $ne: ["$$this", null] },
            },
          },
        },
      },
    ]);

    const stats = queryStats[0] || {
      totalProjects: 0,
      totalQueries: 0,
      statusDistribution: {},
      priorityDistribution: {},
      categoryDistribution: {},
      timeMetrics: {},
      escalationMetrics: {},
      projectsWithQueries: 0,
      resolvedQueriesData: [],
    };

    // Calculate derived metrics
    const derivedMetrics = {
      // Resolution rate
      resolutionRate:
        stats.totalQueries > 0
          ? Math.round(
              ((stats.statusDistribution.resolved +
                stats.statusDistribution.closed) /
                stats.totalQueries) *
                100
            )
          : 0,

      // Recent resolution rate
      recentResolutionRate:
        stats.timeMetrics.recent > 0
          ? Math.round(
              (stats.timeMetrics.resolvedRecent / stats.timeMetrics.recent) *
                100
            )
          : 0,

      // Overdue rate
      overdueRate:
        stats.totalQueries > 0
          ? Math.round((stats.timeMetrics.overdue / stats.totalQueries) * 100)
          : 0,

      // Escalation rate
      escalationRate:
        stats.totalQueries > 0
          ? Math.round(
              (stats.escalationMetrics.total / stats.totalQueries) * 100
            )
          : 0,

      // Project coverage (projects with queries)
      projectCoverageRate:
        stats.totalProjects > 0
          ? Math.round((stats.projectsWithQueries / stats.totalProjects) * 100)
          : 0,

      // Average queries per project
      avgQueriesPerProject:
        stats.totalProjects > 0
          ? Math.round((stats.totalQueries / stats.totalProjects) * 100) / 100
          : 0,

      // Average resolution time (in days)
      avgResolutionTime:
        stats.resolvedQueriesData.length > 0
          ? Math.round(
              (stats.resolvedQueriesData.reduce(
                (sum, query) => sum + query.resolutionDays,
                0
              ) /
                stats.resolvedQueriesData.length) *
                100
            ) / 100
          : 0,

      // Active queries (open + in progress + under review)
      activeQueries:
        (stats.statusDistribution.open || 0) +
        (stats.statusDistribution.inProgress || 0) +
        (stats.statusDistribution.underReview || 0),

      // Critical queries (urgent + overdue + high escalation)
      criticalQueries:
        (stats.priorityDistribution.urgent || 0) +
        (stats.timeMetrics.overdue || 0) +
        (stats.escalationMetrics.level3Plus || 0),
    };

    // Get archive data if requested
    let archiveQueryStats = null;
    if (includeArchive === "true") {
      archiveQueryStats = await ArchiveProject.aggregate([
        { $match: userRole === "JE" ? { "createdBy.userId": userId } : {} },
        { $unwind: { path: "$queries", preserveNullAndEmptyArrays: true } },
        {
          $match: {
            $or: [
              { queries: { $exists: false } },
              { "queries.isActive": true },
            ],
          },
        },
        {
          $group: {
            _id: null,
            totalArchiveQueries: {
              $sum: { $cond: [{ $ne: ["$queries", null] }, 1, 0] },
            },
            resolvedArchiveQueries: {
              $sum: {
                $cond: [
                  { $in: ["$queries.status", ["Resolved", "Closed"]] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]);
    }

    // Get top performers (categories, users, etc.)
    const topCategories = Object.entries(stats.categoryDistribution)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([category, count]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        count,
        percentage:
          stats.totalQueries > 0
            ? Math.round((count / stats.totalQueries) * 100)
            : 0,
      }));

    const response = {
      success: true,
      message: "Query KPIs retrieved successfully",
      data: {
        overview: {
          totalQueries: stats.totalQueries,
          totalProjects: stats.totalProjects,
          projectsWithQueries: stats.projectsWithQueries,
          activeQueries: derivedMetrics.activeQueries,
          criticalQueries: derivedMetrics.criticalQueries,
          ...derivedMetrics,
        },

        distribution: {
          byStatus: stats.statusDistribution,
          byPriority: stats.priorityDistribution,
          byCategory: stats.categoryDistribution,
        },

        timeMetrics: {
          ...stats.timeMetrics,
          avgResolutionTime: derivedMetrics.avgResolutionTime,
          resolutionRate: derivedMetrics.resolutionRate,
          recentResolutionRate: derivedMetrics.recentResolutionRate,
          overdueRate: derivedMetrics.overdueRate,
        },

        escalationMetrics: {
          ...stats.escalationMetrics,
          escalationRate: derivedMetrics.escalationRate,
        },

        insights: {
          topCategories,
          needsAttention: derivedMetrics.criticalQueries > 0,
          resolutionTrend:
            derivedMetrics.recentResolutionRate >= derivedMetrics.resolutionRate
              ? "improving"
              : "declining",
          averageLoad: derivedMetrics.avgQueriesPerProject,
          projectCoverage: derivedMetrics.projectCoverageRate,
        },

        // Archive data if requested
        ...(includeArchive === "true" &&
          archiveQueryStats?.[0] && {
            archiveComparison: {
              totalArchiveQueries:
                archiveQueryStats[0].totalArchiveQueries || 0,
              resolvedArchiveQueries:
                archiveQueryStats[0].resolvedArchiveQueries || 0,
              archiveResolutionRate:
                archiveQueryStats[0].totalArchiveQueries > 0
                  ? Math.round(
                      (archiveQueryStats[0].resolvedArchiveQueries /
                        archiveQueryStats[0].totalArchiveQueries) *
                        100
                    )
                  : 0,
            },
          }),
      },
      metadata: {
        userRole,
        timeRange: `${daysBack} days`,
        includesArchive: includeArchive === "true",
        generatedAt: new Date().toISOString(),
        dateRange: {
          start: startDate.toISOString(),
          end: now.toISOString(),
        },
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error retrieving query KPIs:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving query KPIs",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get query trend analysis
 * GET /api/dashboard/query-trends
 */
export const getQueryTrends = async (req, res) => {
  try {
    const { userRole, userId } = req.user;
    const { period = "weekly", periods = 12 } = req.query;

    const periodsBack = Math.min(parseInt(periods), 52); // Max 52 periods
    const now = new Date();
    const startDate = new Date();

    // Calculate start date based on period
    switch (period) {
      case "daily":
        startDate.setDate(now.getDate() - periodsBack);
        break;
      case "weekly":
        startDate.setDate(now.getDate() - periodsBack * 7);
        break;
      case "monthly":
        startDate.setMonth(now.getMonth() - periodsBack);
        break;
      default:
        startDate.setDate(now.getDate() - periodsBack * 7); // Default to weekly
    }

    // Build filter based on user role
    const userFilter = {};
    if (userRole === "JE") {
      userFilter["createdBy.userId"] = userId;
    }

    // Determine grouping format
    let dateGroupFormat;
    switch (period) {
      case "daily":
        dateGroupFormat = {
          year: { $year: "$queries.raisedDate" },
          month: { $month: "$queries.raisedDate" },
          day: { $dayOfMonth: "$queries.raisedDate" },
        };
        break;
      case "monthly":
        dateGroupFormat = {
          year: { $year: "$queries.raisedDate" },
          month: { $month: "$queries.raisedDate" },
        };
        break;
      default: // weekly
        dateGroupFormat = {
          year: { $year: "$queries.raisedDate" },
          week: { $week: "$queries.raisedDate" },
        };
    }

    const trends = await Project.aggregate([
      { $match: userFilter },
      { $unwind: "$queries" },
      {
        $match: {
          "queries.isActive": true,
          "queries.raisedDate": { $gte: startDate, $lte: now },
        },
      },
      {
        $group: {
          _id: dateGroupFormat,
          queriesRaised: { $sum: 1 },
          queriesResolved: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $in: ["$queries.status", ["Resolved", "Closed"]] },
                    { $ne: ["$queries.actualResolutionDate", null] },
                    { $gte: ["$queries.actualResolutionDate", startDate] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          urgentQueries: {
            $sum: { $cond: [{ $eq: ["$queries.priority", "Urgent"] }, 1, 0] },
          },
          escalatedQueries: {
            $sum: { $cond: [{ $gt: ["$queries.escalationLevel", 0] }, 1, 0] },
          },
          avgResolutionTime: {
            $avg: {
              $cond: [
                {
                  $and: [
                    { $in: ["$queries.status", ["Resolved", "Closed"]] },
                    { $ne: ["$queries.actualResolutionDate", null] },
                    { $ne: ["$queries.raisedDate", null] },
                  ],
                },
                {
                  $divide: [
                    {
                      $subtract: [
                        "$queries.actualResolutionDate",
                        "$queries.raisedDate",
                      ],
                    },
                    86400000,
                  ],
                },
                null,
              ],
            },
          },
          categoryCounts: {
            $push: "$queries.queryCategory",
          },
        },
      },
      {
        $sort: {
          "_id.year": 1,
          "_id.month": 1,
          "_id.week": 1,
          "_id.day": 1,
        },
      },
    ]);

    // Format trends for response
    const formattedTrends = trends.map((trend) => {
      let periodLabel;
      if (period === "daily") {
        periodLabel = `${trend._id.year}-${String(trend._id.month).padStart(
          2,
          "0"
        )}-${String(trend._id.day).padStart(2, "0")}`;
      } else if (period === "monthly") {
        periodLabel = `${trend._id.year}-${String(trend._id.month).padStart(
          2,
          "0"
        )}`;
      } else {
        periodLabel = `${trend._id.year}-W${trend._id.week}`;
      }

      return {
        period: periodLabel,
        queriesRaised: trend.queriesRaised,
        queriesResolved: trend.queriesResolved,
        netQueries: trend.queriesRaised - trend.queriesResolved,
        urgentQueries: trend.urgentQueries,
        escalatedQueries: trend.escalatedQueries,
        resolutionRate:
          trend.queriesRaised > 0
            ? Math.round((trend.queriesResolved / trend.queriesRaised) * 100)
            : 0,
        avgResolutionTime: trend.avgResolutionTime
          ? Math.round(trend.avgResolutionTime * 100) / 100
          : 0,
        urgencyRate:
          trend.queriesRaised > 0
            ? Math.round((trend.urgentQueries / trend.queriesRaised) * 100)
            : 0,
        escalationRate:
          trend.queriesRaised > 0
            ? Math.round((trend.escalatedQueries / trend.queriesRaised) * 100)
            : 0,
      };
    });

    // Calculate trend summary
    const summary = {
      totalPeriods: formattedTrends.length,
      totalQueriesRaised: formattedTrends.reduce(
        (sum, t) => sum + t.queriesRaised,
        0
      ),
      totalQueriesResolved: formattedTrends.reduce(
        (sum, t) => sum + t.queriesResolved,
        0
      ),
      avgQueriesPerPeriod:
        formattedTrends.length > 0
          ? Math.round(
              (formattedTrends.reduce((sum, t) => sum + t.queriesRaised, 0) /
                formattedTrends.length) *
                100
            ) / 100
          : 0,
      avgResolutionRate:
        formattedTrends.length > 0
          ? Math.round(
              formattedTrends.reduce((sum, t) => sum + t.resolutionRate, 0) /
                formattedTrends.length
            )
          : 0,
      trend: calculateTrend(formattedTrends),
    };

    res.status(200).json({
      success: true,
      message: "Query trends retrieved successfully",
      data: {
        trends: formattedTrends,
        summary,
        insights: {
          isImproving: summary.trend.direction === "up",
          bestPeriod: formattedTrends.reduce(
            (best, current) =>
              current.resolutionRate > best.resolutionRate ? current : best,
            formattedTrends[0] || { period: "N/A", resolutionRate: 0 }
          ),
          worstPeriod: formattedTrends.reduce(
            (worst, current) =>
              current.resolutionRate < worst.resolutionRate ? current : worst,
            formattedTrends[0] || { period: "N/A", resolutionRate: 100 }
          ),
        },
      },
      metadata: {
        userRole,
        period,
        periodsAnalyzed: periodsBack,
        dateRange: {
          start: startDate.toISOString(),
          end: now.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Error retrieving query trends:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving query trends",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Helper function to calculate trend direction
function calculateTrend(data) {
  if (data.length < 2) {
    return { direction: "stable", change: 0 };
  }

  const firstHalf = data.slice(0, Math.floor(data.length / 2));
  const secondHalf = data.slice(Math.floor(data.length / 2));

  const firstHalfAvg =
    firstHalf.reduce((sum, item) => sum + item.resolutionRate, 0) /
    firstHalf.length;
  const secondHalfAvg =
    secondHalf.reduce((sum, item) => sum + item.resolutionRate, 0) /
    secondHalf.length;

  const change = secondHalfAvg - firstHalfAvg;
  const direction = change > 2 ? "up" : change < -2 ? "down" : "stable";

  return { direction, change: Math.round(change) };
}

export default {
  getQueryKPIs,
  getQueryTrends,
};
