import Project from "../../models/project.model.js";

// Simple in-memory cache for KPIs (in production, use Redis)
const kpiCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get real-time performance metrics with caching
 * GET /api/dashboard/performance-monitoring
 */
export const getPerformanceMonitoring = async (req, res) => {
  try {
    const { userRole, userId } = req.user;
    const { refresh = false } = req.query;

    const cacheKey = `performance_${userRole}_${userId}`;

    // Check cache first (unless refresh is requested)
    if (!refresh && kpiCache.has(cacheKey)) {
      const cached = kpiCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return res.status(200).json({
          ...cached.data,
          fromCache: true,
          cacheAge: Date.now() - cached.timestamp,
        });
      }
    }

    // Build filter based on user role
    const userFilter = {};
    if (userRole === "JE") {
      userFilter["createdBy.userId"] = userId;
    }

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get real-time metrics
    const [systemHealth, activityMetrics, performanceIndicators, alertMetrics] =
      await Promise.all([
        // System health metrics
        Project.aggregate([
          { $match: userFilter },
          {
            $group: {
              _id: null,
              totalProjects: { $sum: 1 },
              activeProjects: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["Ongoing", "Submitted for Approval"]] },
                    1,
                    0,
                  ],
                },
              },
              criticalProjects: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $lt: ["$projectEndDate", now] },
                        {
                          $and: [
                            { $lt: ["$progressPercentage", 50] },
                            { $lt: ["$projectEndDate", oneMonthAgo] },
                          ],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              healthyProjects: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ["$progressPercentage", 70] },
                        { $gte: ["$financialProgress", 70] },
                        { $gte: ["$projectEndDate", now] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              avgSystemLoad: {
                $avg: { $add: ["$progressPercentage", "$financialProgress"] },
              },
            },
          },
        ]),

        // Activity metrics (last 24 hours, week, month)
        Project.aggregate([
          { $match: userFilter },
          {
            $group: {
              _id: null,
              // Daily activity
              dailyUpdates: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $gte: ["$lastProgressUpdate", oneDayAgo] },
                        { $gte: ["$lastFinancialProgressUpdate", oneDayAgo] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              dailyStatusChanges: {
                $sum: {
                  $cond: [{ $gte: ["$updatedAt", oneDayAgo] }, 1, 0],
                },
              },

              // Weekly activity
              weeklyUpdates: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $gte: ["$lastProgressUpdate", oneWeekAgo] },
                        { $gte: ["$lastFinancialProgressUpdate", oneWeekAgo] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              weeklyNewProjects: {
                $sum: {
                  $cond: [{ $gte: ["$createdAt", oneWeekAgo] }, 1, 0],
                },
              },

              // Monthly activity
              monthlyCompletions: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$status", "Completed"] },
                        { $gte: ["$statusWorkflow.completedAt", oneMonthAgo] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              monthlyNewProjects: {
                $sum: {
                  $cond: [{ $gte: ["$createdAt", oneMonthAgo] }, 1, 0],
                },
              },
            },
          },
        ]),

        // Performance indicators
        Project.aggregate([
          { $match: userFilter },
          {
            $group: {
              _id: null,
              avgResponseTime: { $avg: "$progressPercentage" }, // Simplified metric
              throughput: { $sum: 1 },
              errorRate: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        ["Rejected by AEE", "Rejected by CE", "Rejected by MD"],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              efficiencyScore: {
                $avg: {
                  $multiply: [
                    { $divide: ["$progressPercentage", 100] },
                    { $divide: ["$financialProgress", 100] },
                  ],
                },
              },
              utilizationRate: {
                $avg: {
                  $cond: [
                    { $gt: ["$estimatedCost", 0] },
                    { $divide: ["$billSubmittedAmount", "$estimatedCost"] },
                    0,
                  ],
                },
              },
            },
          },
        ]),

        // Alert metrics
        Project.aggregate([
          { $match: userFilter },
          { $unwind: { path: "$queries", preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: null,
              criticalAlerts: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $lt: ["$projectEndDate", now] },
                        { $eq: ["$queries.priority", "Urgent"] },
                        { $gte: ["$queries.escalationLevel", 3] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              warningAlerts: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $lt: ["$progressPercentage", 25] },
                        { $eq: ["$queries.priority", "High"] },
                        {
                          $and: [
                            { $lt: ["$projectEndDate", oneWeekAgo] },
                            { $ne: ["$status", "Completed"] },
                          ],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              infoAlerts: {
                $sum: {
                  $cond: [
                    {
                      $or: [
                        { $gte: ["$lastProgressUpdate", oneDayAgo] },
                        { $gte: ["$lastFinancialProgressUpdate", oneDayAgo] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ]);

    // Process results
    const health = systemHealth[0] || {};
    const activity = activityMetrics[0] || {};
    const performance = performanceIndicators[0] || {};
    const alerts = alertMetrics[0] || {};

    // Calculate derived metrics
    const systemScore = calculateSystemScore({
      healthyProjects: health.healthyProjects || 0,
      totalProjects: health.totalProjects || 1,
      criticalProjects: health.criticalProjects || 0,
      errorRate: performance.errorRate || 0,
      efficiencyScore: performance.efficiencyScore || 0,
    });

    const activityScore = calculateActivityScore({
      dailyUpdates: activity.dailyUpdates || 0,
      weeklyUpdates: activity.weeklyUpdates || 0,
      monthlyCompletions: activity.monthlyCompletions || 0,
      totalProjects: health.totalProjects || 1,
    });

    const result = {
      success: true,
      message: "Performance monitoring data retrieved successfully",
      data: {
        systemHealth: {
          totalProjects: health.totalProjects || 0,
          activeProjects: health.activeProjects || 0,
          criticalProjects: health.criticalProjects || 0,
          healthyProjects: health.healthyProjects || 0,
          systemScore: systemScore,
          avgSystemLoad: Math.round((health.avgSystemLoad || 0) * 100) / 100,
          status: getSystemStatus(systemScore),
        },

        activityMetrics: {
          daily: {
            updates: activity.dailyUpdates || 0,
            statusChanges: activity.dailyStatusChanges || 0,
            activityRate:
              health.totalProjects > 0
                ? Math.round(
                    ((activity.dailyUpdates || 0) / health.totalProjects) * 100
                  )
                : 0,
          },
          weekly: {
            updates: activity.weeklyUpdates || 0,
            newProjects: activity.weeklyNewProjects || 0,
            growthRate: Math.round(
              ((activity.weeklyNewProjects || 0) /
                Math.max(health.totalProjects, 1)) *
                100
            ),
          },
          monthly: {
            completions: activity.monthlyCompletions || 0,
            newProjects: activity.monthlyNewProjects || 0,
            completionRate:
              health.totalProjects > 0
                ? Math.round(
                    ((activity.monthlyCompletions || 0) /
                      health.totalProjects) *
                      100
                  )
                : 0,
          },
          activityScore: activityScore,
          trend: getActivityTrend(activityScore),
        },

        performanceIndicators: {
          avgResponseTime:
            Math.round((performance.avgResponseTime || 0) * 100) / 100,
          throughput: performance.throughput || 0,
          errorRate: Math.round(
            ((performance.errorRate || 0) / Math.max(health.totalProjects, 1)) *
              100
          ),
          efficiencyScore: Math.round((performance.efficiencyScore || 0) * 100),
          utilizationRate: Math.round((performance.utilizationRate || 0) * 100),
          performance: getPerformanceRating(performance.efficiencyScore || 0),
        },

        alerts: {
          critical: alerts.criticalAlerts || 0,
          warning: alerts.warningAlerts || 0,
          info: alerts.infoAlerts || 0,
          total:
            (alerts.criticalAlerts || 0) +
            (alerts.warningAlerts || 0) +
            (alerts.infoAlerts || 0),
          severity: getAlertSeverity(alerts),
        },

        // Real-time indicators
        realTime: {
          status: "operational",
          uptime: "99.9%", // In production, calculate actual uptime
          lastUpdate: new Date().toISOString(),
          nextUpdate: new Date(Date.now() + CACHE_TTL).toISOString(),
          responseTime: `${Date.now() - now.getTime()}ms`,
        },

        trends: {
          health:
            systemScore > 80
              ? "improving"
              : systemScore > 60
              ? "stable"
              : "declining",
          activity:
            activityScore > 70 ? "high" : activityScore > 40 ? "medium" : "low",
          performance:
            (performance.efficiencyScore || 0) > 0.8
              ? "excellent"
              : (performance.efficiencyScore || 0) > 0.6
              ? "good"
              : "needs_improvement",
        },
      },
      metadata: {
        userRole,
        dataFreshness: "real-time",
        cacheExpiry: CACHE_TTL,
        generatedAt: new Date().toISOString(),
        fromCache: false,
      },
    };

    // Cache the result
    kpiCache.set(cacheKey, {
      data: result,
      timestamp: Date.now(),
    });

    res.status(200).json(result);
  } catch (error) {
    console.error("Error retrieving performance monitoring data:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving performance data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get system alerts and notifications
 * GET /api/dashboard/alerts
 */
export const getSystemAlerts = async (req, res) => {
  try {
    const { userRole, userId } = req.user;
    const { severity, limit = 20, includeResolved = false } = req.query;

    const userFilter = {};
    if (userRole === "JE") {
      userFilter["createdBy.userId"] = userId;
    }

    const now = new Date();
    const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Generate alerts based on project conditions
    const alerts = await Project.aggregate([
      { $match: userFilter },
      { $unwind: { path: "$queries", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          projectId: "$projectId",
          projectName: "$projectName",
          status: "$status",
          progressPercentage: "$progressPercentage",
          financialProgress: "$financialProgress",
          projectEndDate: "$projectEndDate",
          estimatedCost: "$estimatedCost",
          queries: "$queries",
          alerts: {
            $concatArrays: [
              // Overdue project alerts
              {
                $cond: [
                  {
                    $and: [
                      { $lt: ["$projectEndDate", now] },
                      { $ne: ["$status", "Completed"] },
                    ],
                  },
                  [
                    {
                      type: "overdue_project",
                      severity: "critical",
                      title: "Project Overdue",
                      message: {
                        $concat: [
                          "Project '",
                          "$projectName",
                          "' is overdue by ",
                          {
                            $toString: {
                              $divide: [
                                { $subtract: [now, "$projectEndDate"] },
                                86400000,
                              ],
                            },
                          },
                          " days",
                        ],
                      },
                      timestamp: now,
                      actionRequired: true,
                    },
                  ],
                  [],
                ],
              },

              // Low progress alerts
              {
                $cond: [
                  {
                    $and: [
                      { $lt: ["$progressPercentage", 25] },
                      { $lt: ["$projectEndDate", oneWeekFromNow] },
                      { $ne: ["$status", "Completed"] },
                    ],
                  },
                  [
                    {
                      type: "low_progress",
                      severity: "warning",
                      title: "Low Progress Warning",
                      message: {
                        $concat: [
                          "Project '",
                          "$projectName",
                          "' has only ",
                          { $toString: "$progressPercentage" },
                          "% progress with deadline approaching",
                        ],
                      },
                      timestamp: now,
                      actionRequired: true,
                    },
                  ],
                  [],
                ],
              },

              // Budget overrun alerts
              {
                $cond: [
                  { $gt: ["$billSubmittedAmount", "$estimatedCost"] },
                  [
                    {
                      type: "budget_overrun",
                      severity: "critical",
                      title: "Budget Exceeded",
                      message: {
                        $concat: [
                          "Project '",
                          "$projectName",
                          "' has exceeded its budget of ₹",
                          { $toString: "$estimatedCost" },
                        ],
                      },
                      timestamp: now,
                      actionRequired: true,
                    },
                  ],
                  [],
                ],
              },

              // Urgent query alerts
              {
                $cond: [
                  { $eq: ["$queries.priority", "Urgent"] },
                  [
                    {
                      type: "urgent_query",
                      severity: "high",
                      title: "Urgent Query",
                      message: {
                        $concat: [
                          "Urgent query '",
                          "$queries.queryTitle",
                          "' in project '",
                          "$projectName",
                          "'",
                        ],
                      },
                      timestamp: now,
                      actionRequired: true,
                    },
                  ],
                  [],
                ],
              },

              // Escalated query alerts
              {
                $cond: [
                  { $gte: ["$queries.escalationLevel", 3] },
                  [
                    {
                      type: "escalated_query",
                      severity: "critical",
                      title: "Highly Escalated Query",
                      message: {
                        $concat: [
                          "Query '",
                          "$queries.queryTitle",
                          "' escalated to level ",
                          { $toString: "$queries.escalationLevel" },
                        ],
                      },
                      timestamp: now,
                      actionRequired: true,
                    },
                  ],
                  [],
                ],
              },
            ],
          },
        },
      },
      { $unwind: { path: "$alerts", preserveNullAndEmptyArrays: false } },
      {
        $project: {
          alertId: { $toString: "$_id" },
          projectId: "$projectId",
          projectName: "$projectName",
          type: "$alerts.type",
          severity: "$alerts.severity",
          title: "$alerts.title",
          message: "$alerts.message",
          timestamp: "$alerts.timestamp",
          actionRequired: "$alerts.actionRequired",
          resolved: false,
          metadata: {
            progressPercentage: "$progressPercentage",
            financialProgress: "$financialProgress",
            projectEndDate: "$projectEndDate",
            estimatedCost: "$estimatedCost",
          },
        },
      },

      // Filter by severity if specified
      ...(severity ? [{ $match: { severity } }] : []),

      { $sort: { severity: -1, timestamp: -1 } },
      { $limit: parseInt(limit) },
    ]);

    // Group alerts by severity
    const alertsBySeverity = alerts.reduce((acc, alert) => {
      if (!acc[alert.severity]) {
        acc[alert.severity] = [];
      }
      acc[alert.severity].push(alert);
      return acc;
    }, {});

    // Calculate alert statistics
    const alertStats = {
      total: alerts.length,
      critical: (alertsBySeverity.critical || []).length,
      high: (alertsBySeverity.high || []).length,
      warning: (alertsBySeverity.warning || []).length,
      info: (alertsBySeverity.info || []).length,
      actionRequired: alerts.filter((a) => a.actionRequired).length,
      resolved: 0, // In production, track resolved alerts
    };

    res.status(200).json({
      success: true,
      message: "System alerts retrieved successfully",
      data: {
        alerts,
        alertsBySeverity,
        statistics: alertStats,
        summary: {
          totalAlerts: alertStats.total,
          criticalCount: alertStats.critical,
          needingAction: alertStats.actionRequired,
          systemHealth:
            alertStats.critical === 0
              ? "healthy"
              : alertStats.critical <= 2
              ? "warning"
              : "critical",
        },
      },
      metadata: {
        userRole,
        filters: { severity, includeResolved },
        limit: parseInt(limit),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error retrieving system alerts:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving alerts",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Clear cache for performance monitoring
 * POST /api/dashboard/clear-cache
 */
export const clearPerformanceCache = async (req, res) => {
  try {
    const { userRole, userId } = req.user;
    const { cacheType = "all" } = req.body;

    let clearedCount = 0;

    if (cacheType === "all") {
      clearedCount = kpiCache.size;
      kpiCache.clear();
    } else if (cacheType === "user") {
      // Clear only user-specific cache
      const userKeys = Array.from(kpiCache.keys()).filter((key) =>
        key.includes(`_${userRole}_${userId}`)
      );
      userKeys.forEach((key) => {
        kpiCache.delete(key);
        clearedCount++;
      });
    } else if (cacheType === "role") {
      // Clear cache for specific role
      const roleKeys = Array.from(kpiCache.keys()).filter((key) =>
        key.includes(`_${userRole}_`)
      );
      roleKeys.forEach((key) => {
        kpiCache.delete(key);
        clearedCount++;
      });
    }

    res.status(200).json({
      success: true,
      message: `Cache cleared successfully`,
      data: {
        cacheType,
        entriesCleared: clearedCount,
        remainingEntries: kpiCache.size,
        clearedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error clearing cache:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while clearing cache",
    });
  }
};

// Helper functions
function calculateSystemScore({
  healthyProjects,
  totalProjects,
  criticalProjects,
  errorRate,
  efficiencyScore,
}) {
  const healthRatio = healthyProjects / totalProjects;
  const criticalRatio = criticalProjects / totalProjects;
  const errorRatio = errorRate / totalProjects;

  let score = 100;
  score *= healthRatio; // Reduce score based on unhealthy projects
  score -= criticalRatio * 30; // Penalty for critical projects
  score -= errorRatio * 20; // Penalty for errors
  score *= efficiencyScore || 0.5; // Factor in efficiency

  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateActivityScore({
  dailyUpdates,
  weeklyUpdates,
  monthlyCompletions,
  totalProjects,
}) {
  const dailyRate = (dailyUpdates / totalProjects) * 100;
  const weeklyRate = (weeklyUpdates / totalProjects) * 100;
  const monthlyRate = (monthlyCompletions / totalProjects) * 100;

  // Weighted average of activity rates
  const score = dailyRate * 0.5 + weeklyRate * 0.3 + monthlyRate * 0.2;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function getSystemStatus(score) {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 60) return "fair";
  if (score >= 40) return "poor";
  return "critical";
}

function getActivityTrend(score) {
  if (score >= 80) return "very_active";
  if (score >= 60) return "active";
  if (score >= 40) return "moderate";
  if (score >= 20) return "low";
  return "inactive";
}

function getPerformanceRating(efficiency) {
  if (efficiency >= 0.9) return "excellent";
  if (efficiency >= 0.75) return "good";
  if (efficiency >= 0.6) return "satisfactory";
  if (efficiency >= 0.4) return "needs_improvement";
  return "poor";
}

function getAlertSeverity(alerts) {
  if ((alerts.criticalAlerts || 0) > 0) return "critical";
  if ((alerts.warningAlerts || 0) > 5) return "high";
  if ((alerts.warningAlerts || 0) > 0) return "medium";
  return "low";
}

export default {
  getPerformanceMonitoring,
  getSystemAlerts,
  clearPerformanceCache,
};
