import ArchiveProject from "../../models/archive-project.model.js";
import Project from "../../models/project.model.js";

/**
 * Get main dashboard KPIs
 * GET /api/dashboard/kpis
 */
export const getDashboardKPIs = async (req, res) => {
  try {
    const { designation, userId } = req.user;
    const { includeArchive = false } = req.query;

    // Build filter based on user role
    const userFilter = {};
    if (designation === "JE") {
      userFilter["createdBy.userId"] = userId;
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get active projects KPIs
    const [projectOverview, financialOverview, progressOverview] =
      await Promise.all([
        // Project Count Overview
        Project.aggregate([
          { $match: userFilter },
          {
            $group: {
              _id: null,
              totalProjects: { $sum: 1 },
              myProjects: { $sum: 1 }, // Same as total for JE, different for admin
              draftProjects: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        ["Submitted for Approval", "Resubmitted for Approval"],
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              underReviewProjects: {
                $sum: {
                  $cond: [
                    {
                      $in: [
                        "$status",
                        ["Submitted for Approval", "Resubmitted for Approval"],
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
              completedProjects: {
                $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
              },
              rejectedProjects: {
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
              // Overdue projects (past end date and not completed)
              overdueProjects: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $lt: ["$projectEndDate", now] },
                        { $ne: ["$status", "Completed"] },
                        { $lt: ["$progressPercentage", 100] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
              // Projects updated in last 30 days
              recentlyUpdatedProjects: {
                $sum: {
                  $cond: [{ $gte: ["$updatedAt", thirtyDaysAgo] }, 1, 0],
                },
              },
            },
          },
        ]),

        // Financial Overview
        Project.aggregate([
          { $match: userFilter },
          {
            $group: {
              _id: null,
              totalProjectValue: { $sum: "$estimatedCost" },
              totalBillsSubmitted: { $sum: "$billSubmittedAmount" },
              maxProjectValue: { $max: "$estimatedCost" },
              minProjectValue: { $min: "$estimatedCost" },
              projectsWithBills: {
                $sum: { $cond: [{ $gt: ["$billSubmittedAmount", 0] }, 1, 0] },
              },
              totalProjects: { $sum: 1 },
            },
          },
          {
            $addFields: {
              remainingBudget: {
                $subtract: ["$totalProjectValue", "$totalBillsSubmitted"],
              },
              budgetUtilizationRate: {
                $cond: [
                  { $gt: ["$totalProjectValue", 0] },
                  {
                    $multiply: [
                      {
                        $divide: ["$totalBillsSubmitted", "$totalProjectValue"],
                      },
                      100,
                    ],
                  },
                  0,
                ],
              },
              avgProjectValue: {
                $cond: [
                  { $gt: ["$totalProjects", 0] },
                  { $divide: ["$totalProjectValue", "$totalProjects"] },
                  0,
                ],
              },
            },
          },
        ]),

        // Progress Overview
        Project.aggregate([
          { $match: userFilter },
          {
            $group: {
              _id: null,
              avgPhysicalProgress: { $avg: "$progressPercentage" },
              avgFinancialProgress: { $avg: "$financialProgress" },
              totalProjects: { $sum: 1 },

              // Progress distribution
              notStartedProjects: {
                $sum: { $cond: [{ $eq: ["$progressPercentage", 0] }, 1, 0] },
              },
              inProgressProjects: {
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
              completedProgressProjects: {
                $sum: { $cond: [{ $eq: ["$progressPercentage", 100] }, 1, 0] },
              },

              // Projects behind schedule (progress < expected based on time elapsed)
              projectsBehindSchedule: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ["$status", "Completed"] },
                        { $lt: ["$progressPercentage", 50] }, // Simplified logic
                        { $lt: ["$projectEndDate", now] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },

              // Recent progress updates (last 30 days)
              recentProgressUpdates: {
                $sum: {
                  $cond: [
                    { $gte: ["$lastProgressUpdate", thirtyDaysAgo] },
                    1,
                    0,
                  ],
                },
              },
              recentFinancialUpdates: {
                $sum: {
                  $cond: [
                    { $gte: ["$lastFinancialProgressUpdate", thirtyDaysAgo] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ]),
      ]);

    // Get archive data if requested
    let archiveOverview = null;
    if (includeArchive === "true") {
      archiveOverview = await ArchiveProject.aggregate([
        { $match: designation === "JE" ? { "createdBy.userId": userId } : {} },
        {
          $group: {
            _id: null,
            totalArchiveProjects: { $sum: 1 },
            totalArchiveValue: { $sum: "$workValue" },
            avgArchiveProgress: { $avg: "$progress" },
            avgArchiveFinancialProgress: { $avg: "$financialProgress" },
            completedArchiveProjects: {
              $sum: { $cond: [{ $eq: ["$progress", 100] }, 1, 0] },
            },
          },
        },
      ]);
    }

    // Format response
    const overview = projectOverview[0] || {};
    const financial = financialOverview[0] || {};
    const progress = progressOverview[0] || {};
    const archive = archiveOverview?.[0] || {};

    // Calculate performance metrics
    const performanceMetrics = {
      onTimeCompletionRate:
        overview.totalProjects > 0
          ? Math.round(
              (overview.completedProjects / overview.totalProjects) * 100
            )
          : 0,
      progressEfficiencyRate:
        overview.totalProjects > 0
          ? Math.round(
              (progress.completedProgressProjects / overview.totalProjects) *
                100
            )
          : 0,
      financialEfficiencyRate:
        financial.totalProjects > 0
          ? Math.round(
              (financial.projectsWithBills / financial.totalProjects) * 100
            )
          : 0,
      recentActivityRate:
        overview.totalProjects > 0
          ? Math.round(
              (overview.recentlyUpdatedProjects / overview.totalProjects) * 100
            )
          : 0,
    };

    const response = {
      success: true,
      message: "Dashboard KPIs retrieved successfully",
      data: {
        // Project Overview Cards
        projectOverview: {
          totalProjects: overview.totalProjects || 0,
          myProjects: overview.myProjects || 0,
          draftProjects: overview.draftProjects || 0,
          underReview: overview.underReviewProjects || 0,
          ongoing: overview.ongoingProjects || 0,
          completed: overview.completedProjects || 0,
          rejected: overview.rejectedProjects || 0,
          overdue: overview.overdueProjects || 0,
          recentlyUpdated: overview.recentlyUpdatedProjects || 0,
        },

        // Financial Overview
        financialOverview: {
          totalProjectValue: financial.totalProjectValue || 0,
          totalBillsSubmitted: financial.totalBillsSubmitted || 0,
          remainingBudget: financial.remainingBudget || 0,
          budgetUtilizationRate: Math.round(
            financial.budgetUtilizationRate || 0
          ),
          avgProjectValue: Math.round(financial.avgProjectValue || 0),
          projectsWithBills: financial.projectsWithBills || 0,
          maxProjectValue: financial.maxProjectValue || 0,
          minProjectValue: financial.minProjectValue || 0,
        },

        // Progress Overview
        progressOverview: {
          avgPhysicalProgress:
            Math.round((progress.avgPhysicalProgress || 0) * 100) / 100,
          avgFinancialProgress:
            Math.round((progress.avgFinancialProgress || 0) * 100) / 100,
          notStarted: progress.notStartedProjects || 0,
          inProgress: progress.inProgressProjects || 0,
          completed: progress.completedProgressProjects || 0,
          behindSchedule: progress.projectsBehindSchedule || 0,
          recentProgressUpdates: progress.recentProgressUpdates || 0,
          recentFinancialUpdates: progress.recentFinancialUpdates || 0,
        },

        // Performance Metrics
        performanceMetrics,

        // Archive Data (if requested)
        ...(includeArchive === "true" && {
          archiveOverview: {
            totalProjects: archive.totalArchiveProjects || 0,
            totalValue: archive.totalArchiveValue || 0,
            avgProgress:
              Math.round((archive.avgArchiveProgress || 0) * 100) / 100,
            avgFinancialProgress:
              Math.round((archive.avgArchiveFinancialProgress || 0) * 100) /
              100,
            completed: archive.completedArchiveProjects || 0,
          },
        }),
      },
      metadata: {
        designation,
        includesArchive: includeArchive === "true",
        generatedAt: new Date().toISOString(),
        dataRange: "last_30_days_activity",
      },
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error retrieving dashboard KPIs:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving dashboard KPIs",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get recent activity feed for dashboard
 * GET /api/dashboard/recent-activity
 */
export const getRecentActivity = async (req, res) => {
  try {
    const { designation, userId } = req.user;
    const { limit = 10, days = 7 } = req.query;

    const limitNum = Math.min(parseInt(limit), 50); // Max 50 items
    const daysBack = Math.min(parseInt(days), 30); // Max 30 days
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Build filter based on user role
    const userFilter = {};
    if (designation === "JE") {
      userFilter["createdBy.userId"] = userId;
    }

    // Get recent activities from different sources
    const [statusChanges, progressUpdates, financialUpdates, newProjects] =
      await Promise.all([
        // Recent status changes
        Project.aggregate([
          {
            $match: {
              ...userFilter,
              "statusHistory.createdAt": { $gte: startDate },
            },
          },
          { $unwind: "$statusHistory" },
          { $match: { "statusHistory.createdAt": { $gte: startDate } } },
          {
            $project: {
              type: "status_change",
              projectId: "$projectId",
              projectName: "$projectName",
              activity: {
                from: "$statusHistory.previousStatus",
                to: "$statusHistory.newStatus",
                changedBy: "$statusHistory.changedBy.name",
                remarks: "$statusHistory.remarks",
              },
              timestamp: "$statusHistory.createdAt",
              priority: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $in: [
                          "$statusHistory.newStatus",
                          [
                            "Rejected by AEE",
                            "Rejected by CE",
                            "Rejected by MD",
                          ],
                        ],
                      },
                      then: "high",
                    },
                    {
                      case: { $eq: ["$statusHistory.newStatus", "Completed"] },
                      then: "high",
                    },
                    {
                      case: { $eq: ["$statusHistory.newStatus", "Ongoing"] },
                      then: "medium",
                    },
                  ],
                  default: "low",
                },
              },
            },
          },
          { $sort: { timestamp: -1 } },
          { $limit: limitNum },
        ]),

        // Recent progress updates
        Project.aggregate([
          {
            $match: { ...userFilter, lastProgressUpdate: { $gte: startDate } },
          },
          { $unwind: "$progressUpdates" },
          { $match: { "progressUpdates.createdAt": { $gte: startDate } } },
          {
            $project: {
              type: "progress_update",
              projectId: "$projectId",
              projectName: "$projectName",
              activity: {
                from: "$progressUpdates.previousProgress",
                to: "$progressUpdates.newProgress",
                difference: "$progressUpdates.progressDifference",
                updatedBy: "$progressUpdates.updatedBy.userName",
                remarks: "$progressUpdates.remarks",
              },
              timestamp: "$progressUpdates.createdAt",
              priority: {
                $switch: {
                  branches: [
                    {
                      case: { $eq: ["$progressUpdates.newProgress", 100] },
                      then: "high",
                    },
                    {
                      case: {
                        $gte: ["$progressUpdates.progressDifference", 25],
                      },
                      then: "medium",
                    },
                  ],
                  default: "low",
                },
              },
            },
          },
          { $sort: { timestamp: -1 } },
          { $limit: limitNum },
        ]),

        // Recent financial updates
        Project.aggregate([
          {
            $match: {
              ...userFilter,
              lastFinancialProgressUpdate: { $gte: startDate },
            },
          },
          { $unwind: "$financialProgressUpdates" },
          {
            $match: {
              "financialProgressUpdates.createdAt": { $gte: startDate },
            },
          },
          {
            $project: {
              type: "financial_update",
              projectId: "$projectId",
              projectName: "$projectName",
              activity: {
                from: "$financialProgressUpdates.previousFinancialProgress",
                to: "$financialProgressUpdates.newFinancialProgress",
                amountDifference: "$financialProgressUpdates.amountDifference",
                updatedBy: "$financialProgressUpdates.updatedBy.userName",
                remarks: "$financialProgressUpdates.remarks",
              },
              timestamp: "$financialProgressUpdates.createdAt",
              priority: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $eq: [
                          "$financialProgressUpdates.newFinancialProgress",
                          100,
                        ],
                      },
                      then: "high",
                    },
                    {
                      case: {
                        $gte: [
                          "$financialProgressUpdates.amountDifference",
                          100000,
                        ],
                      },
                      then: "medium",
                    },
                  ],
                  default: "low",
                },
              },
            },
          },
          { $sort: { timestamp: -1 } },
          { $limit: limitNum },
        ]),

        // New projects created
        Project.aggregate([
          { $match: { ...userFilter, createdAt: { $gte: startDate } } },
          {
            $project: {
              type: "project_created",
              projectId: "$projectId",
              projectName: "$projectName",
              activity: {
                createdBy: "$createdBy.name",
                estimatedCost: "$estimatedCost",
                district: "$district",
                contractorName: "$contractorName",
              },
              timestamp: "$createdAt",
              priority: "medium",
            },
          },
          { $sort: { timestamp: -1 } },
          { $limit: limitNum },
        ]),
      ]);

    // Combine and sort all activities
    const allActivities = [
      ...statusChanges,
      ...progressUpdates,
      ...financialUpdates,
      ...newProjects,
    ];

    // Sort by timestamp and limit
    const sortedActivities = allActivities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limitNum);

    // Format activities for frontend
    const formattedActivities = sortedActivities.map((activity) => {
      let description, icon, color;

      switch (activity.type) {
        case "status_change":
          description = `Status changed from "${activity.activity.from}" to "${activity.activity.to}"`;
          icon = "status";
          color = activity.activity.to.includes("Rejected")
            ? "red"
            : activity.activity.to === "Completed"
            ? "green"
            : "blue";
          break;

        case "progress_update":
          description = `Progress updated from ${activity.activity.from}% to ${activity.activity.to}%`;
          icon = "progress";
          color = activity.activity.to === 100 ? "green" : "blue";
          break;

        case "financial_update":
          description = `Financial progress updated to ${activity.activity.to}%`;
          icon = "finance";
          color = activity.activity.to === 100 ? "green" : "orange";
          break;

        case "project_created":
          description = `New project created by ${activity.activity.createdBy}`;
          icon = "project";
          color = "purple";
          break;

        default:
          description = "Activity recorded";
          icon = "default";
          color = "gray";
      }

      return {
        id: `${activity.type}_${activity._id}`,
        type: activity.type,
        projectId: activity.projectId,
        projectName: activity.projectName,
        description,
        details: activity.activity,
        timestamp: activity.timestamp,
        priority: activity.priority,
        icon,
        color,
        timeAgo: getTimeAgo(activity.timestamp),
      };
    });

    // Group by date for better UI organization
    const groupedByDate = formattedActivities.reduce((groups, activity) => {
      const date = new Date(activity.timestamp).toDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
      return groups;
    }, {});

    res.status(200).json({
      success: true,
      message: "Recent activity retrieved successfully",
      data: {
        activities: formattedActivities,
        groupedByDate,
        summary: {
          total: formattedActivities.length,
          byType: {
            statusChanges: statusChanges.length,
            progressUpdates: progressUpdates.length,
            financialUpdates: financialUpdates.length,
            newProjects: newProjects.length,
          },
          byPriority: {
            high: formattedActivities.filter((a) => a.priority === "high")
              .length,
            medium: formattedActivities.filter((a) => a.priority === "medium")
              .length,
            low: formattedActivities.filter((a) => a.priority === "low").length,
          },
        },
      },
      metadata: {
        limit: limitNum,
        daysBack,
        dateRange: {
          start: startDate.toISOString(),
          end: new Date().toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Error retrieving recent activity:", error);
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving recent activity",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Get action items that require user attention
 * GET /api/dashboard/action-items
 */
export const getActionItems = async (req, res) => {
  try {
    const { designation, userId } = req.user;
    const { limit = 20 } = req.query;

    const limitNum = Math.min(parseInt(limit), 50);
    const now = new Date();

    // Build filter based on user role
    const userFilter = {};
    if (designation === "JE") {
      userFilter["createdBy.userId"] = userId;
    }

    // Get action items based on user role
    const [pendingApprovals, overdueProjects, openQueries, overdueQueries] =
      await Promise.all([
        // Pending approvals (role-specific)
        Project.aggregate([
          {
            $match: {
              ...userFilter,
              ...(designation === "AEE" && {
                status: "Submitted for Approval",
              }),
              ...(designation === "CE" && { status: "Submitted for Approval" }),
              ...(designation === "MD" && { status: "Submitted for Approval" }),
              ...(designation === "JE" && {
                status: {
                  $in: ["Rejected by AEE", "Rejected by CE", "Rejected by MD"],
                },
              }),
            },
          },
          {
            $project: {
              type: "pending_approval",
              projectId: "$projectId",
              projectName: "$projectName",
              status: "$status",
              submittedAt: "$createdAt",
              estimatedCost: "$estimatedCost",
              district: "$district",
              contractorName: "$contractorName",
              daysWaiting: {
                $divide: [{ $subtract: [now, "$updatedAt"] }, 86400000],
              },
              priority: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $gte: [
                          {
                            $divide: [
                              { $subtract: [now, "$updatedAt"] },
                              86400000,
                            ],
                          },
                          7,
                        ],
                      },
                      then: "high",
                    },
                    {
                      case: {
                        $gte: [
                          {
                            $divide: [
                              { $subtract: [now, "$updatedAt"] },
                              86400000,
                            ],
                          },
                          3,
                        ],
                      },
                      then: "medium",
                    },
                  ],
                  default: "low",
                },
              },
            },
          },
          { $sort: { daysWaiting: -1 } },
          { $limit: limitNum },
        ]),

        // Overdue projects
        Project.aggregate([
          {
            $match: {
              ...userFilter,
              $or: [
                {
                  $and: [
                    { projectEndDate: { $lt: now } },
                    { extensionPeriodForCompletion: { $exists: false } },
                    { progressPercentage: { $lt: 100 } },
                  ],
                },
                {
                  $and: [
                    { extensionPeriodForCompletion: { $lt: now } },
                    { progressPercentage: { $lt: 100 } },
                  ],
                },
              ],
              status: { $nin: ["Completed"] },
            },
          },
          {
            $project: {
              type: "overdue_project",
              projectId: "$projectId",
              projectName: "$projectName",
              progressPercentage: "$progressPercentage",
              financialProgress: "$financialProgress",
              originalEndDate: "$projectEndDate",
              extensionDate: "$extensionPeriodForCompletion",
              effectiveEndDate: {
                $ifNull: ["$extensionPeriodForCompletion", "$projectEndDate"],
              },
              daysOverdue: {
                $divide: [
                  {
                    $subtract: [
                      now,
                      {
                        $ifNull: [
                          "$extensionPeriodForCompletion",
                          "$projectEndDate",
                        ],
                      },
                    ],
                  },
                  86400000,
                ],
              },
              priority: {
                $switch: {
                  branches: [
                    {
                      case: {
                        $gte: [
                          {
                            $divide: [
                              {
                                $subtract: [
                                  now,
                                  {
                                    $ifNull: [
                                      "$extensionPeriodForCompletion",
                                      "$projectEndDate",
                                    ],
                                  },
                                ],
                              },
                              86400000,
                            ],
                          },
                          30,
                        ],
                      },
                      then: "high",
                    },
                    {
                      case: {
                        $gte: [
                          {
                            $divide: [
                              {
                                $subtract: [
                                  now,
                                  {
                                    $ifNull: [
                                      "$extensionPeriodForCompletion",
                                      "$projectEndDate",
                                    ],
                                  },
                                ],
                              },
                              86400000,
                            ],
                          },
                          7,
                        ],
                      },
                      then: "medium",
                    },
                  ],
                  default: "low",
                },
              },
            },
          },
          { $sort: { daysOverdue: -1 } },
          { $limit: limitNum },
        ]),

        // Open queries in user's projects
        Project.aggregate([
          { $match: userFilter },
          { $unwind: "$queries" },
          {
            $match: {
              "queries.isActive": true,
              "queries.status": { $in: ["Open", "In Progress"] },
            },
          },
          {
            $project: {
              type: "open_query",
              projectId: "$projectId",
              projectName: "$projectName",
              queryId: "$queries.queryId",
              queryTitle: "$queries.queryTitle",
              queryCategory: "$queries.queryCategory",
              priority: "$queries.priority",
              raisedDate: "$queries.raisedDate",
              expectedResolutionDate: "$queries.expectedResolutionDate",
              assignedTo: "$queries.assignedTo",
              daysSinceRaised: {
                $divide: [
                  { $subtract: [now, "$queries.raisedDate"] },
                  86400000,
                ],
              },
              daysUntilDue: {
                $divide: [
                  { $subtract: ["$queries.expectedResolutionDate", now] },
                  86400000,
                ],
              },
            },
          },
          { $sort: { "queries.priority": -1, daysSinceRaised: -1 } },
          { $limit: limitNum },
        ]),

        // Overdue queries
        Project.aggregate([
          { $match: userFilter },
          { $unwind: "$queries" },
          {
            $match: {
              "queries.isActive": true,
              "queries.expectedResolutionDate": { $lt: now },
              "queries.status": { $nin: ["Resolved", "Closed"] },
            },
          },
          {
            $project: {
              type: "overdue_query",
              projectId: "$projectId",
              projectName: "$projectName",
              queryId: "$queries.queryId",
              queryTitle: "$queries.queryTitle",
              queryCategory: "$queries.queryCategory",
              priority: "$queries.priority",
              expectedResolutionDate: "$queries.expectedResolutionDate",
              assignedTo: "$queries.assignedTo",
              escalationLevel: "$queries.escalationLevel",
              daysOverdue: {
                $divide: [
                  { $subtract: [now, "$queries.expectedResolutionDate"] },
                  86400000,
                ],
              },
              urgencyScore: {
                $add: [
                  { $cond: [{ $eq: ["$queries.priority", "Urgent"] }, 100, 0] },
                  { $cond: [{ $eq: ["$queries.priority", "High"] }, 50, 0] },
                  { $multiply: ["$queries.escalationLevel", 20] },
                  {
                    $multiply: [
                      {
                        $divide: [
                          {
                            $subtract: [now, "$queries.expectedResolutionDate"],
                          },
                          86400000,
                        ],
                      },
                      5,
                    ],
                  },
                ],
              },
            },
          },
          { $sort: { urgencyScore: -1 } },
          { $limit: limitNum },
        ]),
      ]);

    // Combine and format action items
    const allActionItems = [
      ...pendingApprovals.map((item) => ({
        ...item,
        description: getApprovalDescription(item, designation),
        actionRequired: getApprovalAction(item, designation),
        daysWaiting: Math.ceil(item.daysWaiting),
      })),
      ...overdueProjects.map((item) => ({
        ...item,
        description: `Project is ${Math.ceil(item.daysOverdue)} days overdue (${
          item.progressPercentage
        }% complete)`,
        actionRequired: "Update project progress or request extension",
        daysOverdue: Math.ceil(item.daysOverdue),
      })),
      ...openQueries.map((item) => ({
        ...item,
        description: `${
          item.priority
        } priority ${item.queryCategory.toLowerCase()} query: ${
          item.queryTitle
        }`,
        actionRequired: item.assignedTo
          ? "Follow up on query resolution"
          : "Assign query to team member",
        daysSinceRaised: Math.ceil(item.daysSinceRaised),
        daysUntilDue: Math.ceil(item.daysUntilDue),
      })),
      ...overdueQueries.map((item) => ({
        ...item,
        description: `Overdue ${item.priority.toLowerCase()} priority query: ${
          item.queryTitle
        }`,
        actionRequired: "Escalate or resolve immediately",
        daysOverdue: Math.ceil(item.daysOverdue),
      })),
    ];

    // Sort by priority and urgency
    const sortedActionItems = allActionItems
      .sort((a, b) => {
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        // Secondary sort by days (overdue, waiting, etc.)
        const aDays = a.daysOverdue || a.daysWaiting || a.daysSinceRaised || 0;
        const bDays = b.daysOverdue || b.daysWaiting || b.daysSinceRaised || 0;
        return bDays - aDays;
      })
      .slice(0, limitNum);

    // Group by type for summary
    const summary = {
      total: sortedActionItems.length,
      byType: {
        pendingApprovals: pendingApprovals.length,
        overdueProjects: overdueProjects.length,
        openQueries: openQueries.length,
        overdueQueries: overdueQueries.length,
      },
      byPriority: {
        high: sortedActionItems.filter((item) => item.priority === "high")
          .length,
        medium: sortedActionItems.filter((item) => item.priority === "medium")
          .length,
        low: sortedActionItems.filter((item) => item.priority === "low").length,
      },
    };

    res.status(200).json({
      success: true,
      message: "Action items retrieved successfully",
      data: {
        actionItems: sortedActionItems,
        summary,
        userCapabilities: getUserCapabilities(designation),
      },
      metadata: {
        designation,
        limit: limitNum,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error retrieving action items:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving action items",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Helper functions
function getTimeAgo(timestamp) {
  const now = new Date();
  const diff = now - new Date(timestamp);
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  return "Just now";
}

function getApprovalDescription(item, userRole) {
  switch (userRole) {
    case "AEE":
    case "CE":
    case "MD":
      return `Project "${item.projectName}" awaiting your approval (${Math.ceil(
        item.daysWaiting
      )} days)`;
    case "JE":
      return `Project "${item.projectName}" was rejected - requires resubmission`;
    default:
      return `Project "${item.projectName}" pending approval`;
  }
}

function getApprovalAction(item, userRole) {
  switch (userRole) {
    case "AEE":
    case "CE":
    case "MD":
      return "Review and approve/reject project";
    case "JE":
      return "Address rejection feedback and resubmit";
    default:
      return "Monitor approval status";
  }
}

function getUserCapabilities(userRole) {
  switch (userRole) {
    case "JE":
      return {
        canApprove: false,
        canCreateProject: true,
        canUpdateProgress: true,
        canResubmit: true,
      };
    case "AEE":
    case "CE":
    case "MD":
      return {
        canApprove: true,
        canCreateProject: false,
        canUpdateProgress: false,
        canResubmit: false,
      };
    default:
      return {
        canApprove: false,
        canCreateProject: false,
        canUpdateProgress: false,
        canResubmit: false,
      };
  }
}

export default {
  getDashboardKPIs,
  getRecentActivity,
  getActionItems,
};
