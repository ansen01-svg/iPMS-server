import express from "express";

// Dashboard Controllers
import {
  getActionItems,
  getDashboardKPIs,
  getRecentActivity,
} from "../controller/dashboard/dashboard-kpi.js";

import {
  getQueryKPIs,
  getQueryTrends,
} from "../controller/dashboard/query-kpi.js";

import {
  getArchiveComparison,
  getArchiveKPIs,
} from "../controller/dashboard/archive-project-kpi.js";

import {
  clearPerformanceCache,
  getPerformanceMonitoring,
  getSystemAlerts,
} from "../controller/dashboard/performance-monitoring-kpi.js";

import {
  exportDashboardCSV,
  exportDashboardExcel,
  exportDashboardJSON,
  exportDashboardPDF,
} from "../controller/dashboard/dashboard-kpi-export.js";

// Existing project controllers (for integration)
import {
  getContractorWiseProjectsSummary,
  getDistrictWiseProjectsSummary,
  getProjectsSummary,
} from "../controller/project/get-summary.js";

// Authentication and validation middleware
import { requireLogin } from "../middlewares/auth.middleware.js";
import {
  dashboardErrorHandler,
  dashboardRateLimit,
  logDashboardAccess,
  validateActionItemsQuery,
  validateActivityQuery,
  validateDashboardPermissions,
  validateDashboardQuery,
  validateFinancialHealthQuery,
  validatePerformanceQuery,
  validateQueryKPIsQuery,
  validateQueryTrendsQuery,
  validateWorkloadQuery,
} from "../middlewares/validate-dashboard.middleware.js";

const router = express.Router();

// Apply common middleware to all dashboard routes
router.use(requireLogin());
router.use(logDashboardAccess);
router.use(dashboardRateLimit);

// ==========================================
// CORE DASHBOARD KPIs ENDPOINTS
// ==========================================

/**
 * @route   GET /api/dashboard/kpis
 * @desc    Get main dashboard KPIs (project counts, financial overview, progress metrics)
 * @access  All authenticated users (filtered by role)
 * @returns {Object} Project overview, financial metrics, performance indicators
 */
router.get("/kpis", validateDashboardQuery, getDashboardKPIs);

/**
 * @route   GET /api/dashboard/recent-activity
 * @desc    Get recent activity feed for dashboard
 * @access  All authenticated users (filtered by role)
 * @returns {Array} Recent status changes, progress updates, new projects
 */
router.get("/recent-activity", validateActivityQuery, getRecentActivity);

/**
 * @route   GET /api/dashboard/action-items
 * @desc    Get action items requiring user attention
 * @access  All authenticated users (role-specific items)
 * @returns {Array} Pending approvals, overdue projects, critical queries
 */
router.get("/action-items", validateActionItemsQuery, getActionItems);

// ==========================================
// QUERY MANAGEMENT DASHBOARD
// ==========================================

/**
 * @route   GET /api/dashboard/query-kpis
 * @desc    Get query management KPIs and statistics
 * @access  All authenticated users
 * @returns {Object} Query counts, resolution rates, escalation metrics
 */
router.get("/query-kpis", validateQueryKPIsQuery, getQueryKPIs);

/**
 * @route   GET /api/dashboard/query-trends
 * @desc    Get query trend analysis over time
 * @access  All authenticated users
 * @returns {Object} Historical query trends, resolution patterns
 */
router.get("/query-trends", validateQueryTrendsQuery, getQueryTrends);

// ==========================================
// ARCHIVE PROJECTS DASHBOARD
// ==========================================

/**
 * @route   GET /api/dashboard/archive-kpis
 * @desc    Get archive projects KPIs for historical analysis
 * @access  All authenticated users
 * @returns {Object} Archive project metrics, historical performance
 */
router.get("/archive-kpis", getArchiveKPIs);

/**
 * @route   GET /api/dashboard/archive-comparison
 * @desc    Compare archive vs active project performance
 * @access  All authenticated users
 * @returns {Object} Comparative analysis between archive and active projects
 */
router.get("/archive-comparison", getArchiveComparison);

// ==========================================
// PERFORMANCE MONITORING & ALERTS
// ==========================================

/**
 * @route   GET /api/dashboard/performance-monitoring
 * @desc    Get real-time performance metrics with caching
 * @access  All authenticated users
 * @returns {Object} System health, activity metrics, performance indicators
 */
router.get("/performance-monitoring", getPerformanceMonitoring);

/**
 * @route   GET /api/dashboard/alerts
 * @desc    Get system alerts and notifications
 * @access  All authenticated users
 * @returns {Array} Critical alerts, warnings, system notifications
 */
router.get("/alerts", getSystemAlerts);

/**
 * @route   POST /api/dashboard/clear-cache
 * @desc    Clear performance monitoring cache
 * @access  All authenticated users (clears own cache)
 * @body    {string} cacheType - "all", "user", or "role"
 */
router.post("/clear-cache", clearPerformanceCache);

// ==========================================
// COMPREHENSIVE ANALYTICS ENDPOINTS
// ==========================================

/**
 * @route   GET /api/dashboard/project-analytics
 * @desc    Get comprehensive project analytics (uses existing controller)
 * @access  All authenticated users
 * @returns {Object} Detailed project analytics, top performers, distributions
 */
router.get(
  "/project-analytics",
  validateDashboardPermissions("viewAnalytics"),
  getProjectsSummary
);

// need
/**
 * @route   GET /api/dashboard/district-analytics
 * @desc    Get district-wise project analytics
 * @access  AEE, CE, MD only
 * @returns {Object} Geographic distribution and performance by district
 */
router.get(
  "/district-analytics",
  validateDashboardPermissions("viewDistrictData"),
  getDistrictWiseProjectsSummary
);

/**
 * @route   GET /api/dashboard/contractor-analytics
 * @desc    Get contractor performance analytics
 * @access  AEE, CE, MD only
 * @returns {Object} Contractor-wise metrics and performance comparison
 */
router.get(
  "/contractor-analytics",
  validateDashboardPermissions("viewContractorData"),
  getContractorWiseProjectsSummary
);

// ==========================================
// SPECIALIZED WIDGET ENDPOINTS
// ==========================================

/**
 * @route   GET /api/dashboard/financial-health
 * @desc    Get financial health indicators for dashboard widget
 * @access  AEE, CE, MD only
 * @returns {Object} Budget utilization, financial progress, cost metrics
 */
router.get(
  "/financial-health",
  validateDashboardPermissions("viewFinancials"),
  validateFinancialHealthQuery,
  async (req, res, next) => {
    try {
      const { userRole, userId } = req.user;

      const userFilter = {};
      if (userRole === "JE") {
        userFilter["createdBy.userId"] = userId;
      }

      const Project = (await import("../../models/project.model.js")).default;

      const financialHealth = await Project.aggregate([
        { $match: userFilter },
        {
          $group: {
            _id: null,
            totalBudget: { $sum: "$estimatedCost" },
            totalUtilized: { $sum: "$billSubmittedAmount" },
            totalProjects: { $sum: 1 },
            avgUtilization: {
              $avg: { $divide: ["$billSubmittedAmount", "$estimatedCost"] },
            },
            overBudgetProjects: {
              $sum: {
                $cond: [
                  { $gt: ["$billSubmittedAmount", "$estimatedCost"] },
                  1,
                  0,
                ],
              },
            },
            fullyUtilizedProjects: {
              $sum: { $cond: [{ $eq: ["$financialProgress", 100] }, 1, 0] },
            },
            underUtilizedProjects: {
              $sum: { $cond: [{ $lt: ["$financialProgress", 25] }, 1, 0] },
            },
          },
        },
      ]);

      const health = financialHealth[0] || {};

      res.status(200).json({
        success: true,
        data: {
          totalBudget: health.totalBudget || 0,
          totalUtilized: health.totalUtilized || 0,
          remainingBudget:
            (health.totalBudget || 0) - (health.totalUtilized || 0),
          utilizationRate:
            health.totalBudget > 0
              ? Math.round((health.totalUtilized / health.totalBudget) * 100)
              : 0,
          avgProjectUtilization: Math.round((health.avgUtilization || 0) * 100),
          riskIndicators: {
            overBudgetProjects: health.overBudgetProjects || 0,
            underUtilizedProjects: health.underUtilizedProjects || 0,
            healthScore: calculateFinancialHealthScore(health),
          },
          distribution: {
            fullyUtilized: health.fullyUtilizedProjects || 0,
            underUtilized: health.underUtilizedProjects || 0,
            normal:
              (health.totalProjects || 0) -
              (health.fullyUtilizedProjects || 0) -
              (health.underUtilizedProjects || 0),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route   GET /api/dashboard/performance-indicators
 * @desc    Get performance indicators for dashboard widget
 * @access  All authenticated users
 * @returns {Object} Efficiency metrics, completion rates, timeline adherence
 */
router.get(
  "/performance-indicators",
  validatePerformanceQuery,
  async (req, res, next) => {
    try {
      const { userRole, userId } = req.user;
      const now = new Date();

      const userFilter = {};
      if (userRole === "JE") {
        userFilter["createdBy.userId"] = userId;
      }

      const Project = (await import("../../models/project.model.js")).default;

      const [performanceMetrics, timelineMetrics] = await Promise.all([
        Project.aggregate([
          { $match: userFilter },
          {
            $group: {
              _id: null,
              totalProjects: { $sum: 1 },
              completedProjects: {
                $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
              },
              onTimeCompletions: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ["$status", "Completed"] },
                        {
                          $lte: [
                            "$statusWorkflow.completedAt",
                            "$projectEndDate",
                          ],
                        },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              avgPhysicalProgress: { $avg: "$progressPercentage" },
              avgFinancialProgress: { $avg: "$financialProgress" },
              highPerformingProjects: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $gte: ["$progressPercentage", 75] },
                        { $gte: ["$financialProgress", 75] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              lowPerformingProjects: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $lt: ["$progressPercentage", 25] },
                        { $lt: ["$financialProgress", 25] },
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
        Project.aggregate([
          { $match: userFilter },
          {
            $group: {
              _id: null,
              projectsWithDeadlines: {
                $sum: { $cond: [{ $ne: ["$projectEndDate", null] }, 1, 0] },
              },
              overdueProjects: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $lt: ["$projectEndDate", now] },
                        { $ne: ["$status", "Completed"] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              projectsWithExtensions: {
                $sum: {
                  $cond: [
                    { $ne: ["$extensionPeriodForCompletion", null] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ]);

      const performance = performanceMetrics[0] || {};
      const timeline = timelineMetrics[0] || {};

      res.status(200).json({
        success: true,
        data: {
          completionRate:
            performance.totalProjects > 0
              ? Math.round(
                  (performance.completedProjects / performance.totalProjects) *
                    100
                )
              : 0,
          onTimeCompletionRate:
            performance.completedProjects > 0
              ? Math.round(
                  (performance.onTimeCompletions /
                    performance.completedProjects) *
                    100
                )
              : 0,
          avgPhysicalProgress: Math.round(performance.avgPhysicalProgress || 0),
          avgFinancialProgress: Math.round(
            performance.avgFinancialProgress || 0
          ),
          timelineAdherence:
            timeline.projectsWithDeadlines > 0
              ? Math.round(
                  ((timeline.projectsWithDeadlines - timeline.overdueProjects) /
                    timeline.projectsWithDeadlines) *
                    100
                )
              : 100,
          performanceDistribution: {
            high: performance.highPerformingProjects || 0,
            low: performance.lowPerformingProjects || 0,
            normal:
              (performance.totalProjects || 0) -
              (performance.highPerformingProjects || 0) -
              (performance.lowPerformingProjects || 0),
          },
          riskFactors: {
            overdueProjects: timeline.overdueProjects || 0,
            projectsWithExtensions: timeline.projectsWithExtensions || 0,
            extensionRate:
              timeline.projectsWithDeadlines > 0
                ? Math.round(
                    (timeline.projectsWithExtensions /
                      timeline.projectsWithDeadlines) *
                      100
                  )
                : 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// need
/**
 * @route   GET /api/dashboard/workload-distribution
 * @desc    Get workload distribution for management dashboard
 * @access  AEE, CE, MD only
 * @returns {Object} Projects by user, district, status distribution
 */
router.get(
  "/workload-distribution",
  validateDashboardPermissions("viewAnalytics"),
  validateWorkloadQuery,
  async (req, res, next) => {
    try {
      const { userRole, userId } = req.user;
      const { groupBy = "user", limit = 10 } = req.query;

      const userFilter = {};
      if (userRole === "JE") {
        userFilter["createdBy.userId"] = userId;
      }

      const Project = (await import("../models/project.model.js")).default;

      let groupField, labelField;
      switch (groupBy) {
        case "district":
          groupField = "$district";
          labelField = "district";
          break;
        case "status":
          groupField = "$status";
          labelField = "status";
          break;
        case "fund":
          groupField = "$fund";
          labelField = "fund";
          break;
        case "contractor":
          groupField = "$contractorName";
          labelField = "contractor";
          break;
        default: // user
          groupField = {
            userId: "$createdBy.userId",
            userName: "$createdBy.name",
            userRole: "$createdBy.role",
          };
          labelField = "user";
      }

      const distribution = await Project.aggregate([
        { $match: userFilter },
        {
          $group: {
            _id: groupField,
            projectCount: { $sum: 1 },
            totalValue: { $sum: "$estimatedCost" },
            completedCount: {
              $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
            },
            ongoingCount: {
              $sum: { $cond: [{ $eq: ["$status", "Ongoing"] }, 1, 0] },
            },
            avgProgress: { $avg: "$progressPercentage" },
          },
        },
        {
          $project: {
            [labelField]: labelField === "user" ? "$_id" : "$_id",
            projectCount: 1,
            totalValue: 1,
            completionRate: {
              $cond: [
                { $gt: ["$projectCount", 0] },
                {
                  $multiply: [
                    { $divide: ["$completedCount", "$projectCount"] },
                    100,
                  ],
                },
                0,
              ],
            },
            avgProgress: { $round: ["$avgProgress", 2] },
            workload: {
              $switch: {
                branches: [
                  {
                    case: {
                      $and: [
                        { $lte: ["$ongoingCount", 3] },
                        { $lt: ["$totalValue", 5000000] },
                      ],
                    },
                    then: "Light",
                  },
                  {
                    case: {
                      $and: [
                        { $lte: ["$ongoingCount", 6] },
                        { $lt: ["$totalValue", 15000000] },
                      ],
                    },
                    then: "Medium",
                  },
                ],
                default: "Heavy",
              },
            },
          },
        },
        { $sort: { projectCount: -1 } },
        { $limit: parseInt(limit) },
      ]);

      res.status(200).json({
        success: true,
        data: {
          distribution,
          summary: {
            totalEntries: distribution.length,
            groupedBy: groupBy,
            totalProjects: distribution.reduce(
              (sum, item) => sum + item.projectCount,
              0
            ),
            avgCompletionRate:
              distribution.length > 0
                ? Math.round(
                    distribution.reduce(
                      (sum, item) => sum + item.completionRate,
                      0
                    ) / distribution.length
                  )
                : 0,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// DATA EXPORT ENDPOINTS
// ==========================================

/**
 * @route   GET /api/dashboard/export/excel
 * @desc    Export dashboard data to Excel format
 * @access  AEE, CE, MD only
 * @query   {string} sections - Comma-separated list of sections to export
 * @returns {File} Excel file download
 */
router.get(
  "/export/excel",
  validateDashboardPermissions("exportData"),
  exportDashboardExcel
);

/**
 * @route   GET /api/dashboard/export/pdf
 * @desc    Export dashboard data to PDF format
 * @access  AEE, CE, MD only
 * @query   {string} sections - Comma-separated list of sections to export
 * @returns {File} PDF file download
 */
router.get(
  "/export/pdf",
  validateDashboardPermissions("exportData"),
  exportDashboardPDF
);

/**
 * @route   GET /api/dashboard/export/json
 * @desc    Export dashboard data to JSON format
 * @access  All authenticated users
 * @query   {string} sections - Comma-separated list of sections to export
 * @returns {Object} JSON data export
 */
router.get("/export/json", exportDashboardJSON);

/**
 * @route   GET /api/dashboard/export/csv
 * @desc    Export specific dashboard section to CSV format
 * @access  All authenticated users
 * @query   {string} section - Single section to export (overview, projects, queries, financial)
 * @returns {File} CSV file download
 */
router.get("/export/csv", exportDashboardCSV);

// ==========================================
// DASHBOARD CONFIGURATION & UTILITIES
// ==========================================

/**
 * @route   GET /api/dashboard/config
 * @desc    Get dashboard configuration for user role
 * @access  All authenticated users
 * @returns {Object} Available widgets, permissions, layout options
 */
router.get("/config", (req, res) => {
  const { userRole } = req.user;

  const config = {
    availableWidgets: getAvailableWidgets(userRole),
    permissions: getPermissions(userRole),
    defaultLayout: getDefaultLayout(userRole),
    refreshIntervals: {
      kpis: 300000, // 5 minutes
      activity: 60000, // 1 minute
      actionItems: 120000, // 2 minutes
      analytics: 600000, // 10 minutes
      performance: 180000, // 3 minutes
    },
    featureFlags: {
      enableArchiveComparison: true,
      enablePerformanceMonitoring: true,
      enableRealTimeAlerts: true,
      enableDataExport: ["AEE", "CE", "MD"].includes(userRole),
      enableQueryAnalytics: true,
    },
  };

  res.status(200).json({
    success: true,
    data: config,
  });
});

/**
 * @route   GET /api/dashboard/health
 * @desc    Get dashboard system health status
 * @access  All authenticated users
 * @returns {Object} System health, API status, cache status
 */
router.get("/health", async (req, res) => {
  try {
    const startTime = Date.now();

    // Test database connection
    const Project = (await import("../../models/project.model.js")).default;
    await Project.findOne().limit(1);

    const dbResponseTime = Date.now() - startTime;

    res.status(200).json({
      success: true,
      status: "healthy",
      timestamp: new Date().toISOString(),
      checks: {
        database: {
          status: "up",
          responseTime: `${dbResponseTime}ms`,
        },
        api: {
          status: "up",
          version: "1.0.0",
        },
        cache: {
          status: "up",
          entries: "available", // In production, show actual cache stats
        },
      },
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: "unhealthy",
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// ==========================================
// ERROR HANDLING MIDDLEWARE
// ==========================================

// Apply error handling middleware to all dashboard routes
router.use(dashboardErrorHandler);

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function calculateFinancialHealthScore(health) {
  const utilizationRate =
    health.totalBudget > 0
      ? (health.totalUtilized / health.totalBudget) * 100
      : 0;

  const overBudgetPenalty = (health.overBudgetProjects || 0) * 10;
  const underUtilizationPenalty = (health.underUtilizedProjects || 0) * 5;

  let score = 100;
  if (utilizationRate > 90) score -= 20;
  if (utilizationRate < 30) score -= 30;
  score -= overBudgetPenalty;
  score -= underUtilizationPenalty;

  return Math.max(0, Math.min(100, score));
}

function getAvailableWidgets(userRole) {
  const commonWidgets = [
    "project-overview",
    "recent-activity",
    "performance-indicators",
    "action-items",
  ];

  switch (userRole) {
    case "MD":
    case "CE":
      return [
        ...commonWidgets,
        "financial-health",
        "district-analytics",
        "contractor-analytics",
        "query-management",
        "approval-queue",
        "archive-comparison",
        "performance-monitoring",
      ];
    case "AEE":
      return [
        ...commonWidgets,
        "financial-health",
        "query-management",
        "approval-queue",
        "workload-distribution",
        "performance-monitoring",
      ];
    case "JE":
      return [
        ...commonWidgets,
        "project-progress",
        "query-status",
        "my-projects",
      ];
    default:
      return commonWidgets;
  }
}

function getPermissions(userRole) {
  return {
    canViewAllProjects: ["MD", "CE"].includes(userRole),
    canViewFinancials: ["MD", "CE", "AEE"].includes(userRole),
    canViewAnalytics: ["MD", "CE", "AEE"].includes(userRole),
    canViewDistrictData: ["MD", "CE", "AEE"].includes(userRole),
    canViewContractorData: ["MD", "CE", "AEE"].includes(userRole),
    canApprove: ["MD", "CE", "AEE"].includes(userRole),
    canCreate: userRole === "JE",
    canExport: ["MD", "CE", "AEE"].includes(userRole),
    canManageQueries: true,
    canViewPerformanceMonitoring: true,
    canClearCache: true,
  };
}

function getDefaultLayout(userRole) {
  switch (userRole) {
    case "MD":
    case "CE":
      return {
        sections: [
          {
            id: "executive-overview",
            title: "Executive Overview",
            widgets: [
              "project-overview",
              "financial-health",
              "performance-monitoring",
            ],
          },
          {
            id: "analytics",
            title: "Analytics & Insights",
            widgets: [
              "district-analytics",
              "contractor-analytics",
              "archive-comparison",
            ],
          },
          {
            id: "management",
            title: "Management Dashboard",
            widgets: ["query-management", "approval-queue", "recent-activity"],
          },
        ],
        layout: "executive",
      };
    case "AEE":
      return {
        sections: [
          {
            id: "overview",
            title: "Project Overview",
            widgets: ["project-overview", "approval-queue"],
          },
          {
            id: "performance",
            title: "Performance & Workload",
            widgets: ["performance-indicators", "workload-distribution"],
          },
          {
            id: "activity",
            title: "Activity & Queries",
            widgets: ["recent-activity", "query-management", "action-items"],
          },
        ],
        layout: "manager",
      };
    case "JE":
      return {
        sections: [
          {
            id: "my-work",
            title: "My Work",
            widgets: ["project-overview", "action-items"],
          },
          {
            id: "progress",
            title: "Project Progress",
            widgets: ["project-progress", "recent-activity"],
          },
          {
            id: "support",
            title: "Support & Queries",
            widgets: ["query-status", "performance-indicators"],
          },
        ],
        layout: "engineer",
      };
    default:
      return {
        sections: [
          {
            id: "overview",
            title: "Overview",
            widgets: ["project-overview", "recent-activity"],
          },
        ],
        layout: "basic",
      };
  }
}

export default router;
