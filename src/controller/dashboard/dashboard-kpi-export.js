import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import { getArchiveKPIs } from "./archive-project-kpi.js";
import { getDashboardKPIs } from "./dashboard-kpi.js";
import { getQueryKPIs } from "./query-kpi.js";

/**
 * Export dashboard data to Excel
 * GET /api/dashboard/export/excel
 */
export const exportDashboardExcel = async (req, res) => {
  try {
    const { userRole, userId } = req.user;
    const { sections = "all", includeCharts = false } = req.query;

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = `${req.user.name || "System"}`;
    workbook.created = new Date();
    workbook.modified = new Date();

    // Get dashboard data by calling existing controllers
    const dashboardData = await getDashboardDataForExport(req);

    // Add Overview sheet
    if (sections === "all" || sections.includes("overview")) {
      await addOverviewSheet(workbook, dashboardData.overview);
    }

    // Add Project Analytics sheet
    if (sections === "all" || sections.includes("projects")) {
      await addProjectAnalyticsSheet(workbook, dashboardData.projects);
    }

    // Add Query Analytics sheet
    if (sections === "all" || sections.includes("queries")) {
      await addQueryAnalyticsSheet(workbook, dashboardData.queries);
    }

    // Add Financial Analysis sheet
    if (sections === "all" || sections.includes("financial")) {
      await addFinancialAnalysisSheet(workbook, dashboardData.financial);
    }

    // Add Performance Metrics sheet
    if (sections === "all" || sections.includes("performance")) {
      await addPerformanceMetricsSheet(workbook, dashboardData.performance);
    }

    // Add Archive Comparison sheet (if archive data exists)
    if (
      dashboardData.archive &&
      (sections === "all" || sections.includes("archive"))
    ) {
      await addArchiveComparisonSheet(workbook, dashboardData.archive);
    }

    // Set response headers
    const filename = `dashboard-export-${userRole}-${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Write to response
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error("Error exporting dashboard to Excel:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while exporting dashboard data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Export dashboard data to PDF
 * GET /api/dashboard/export/pdf
 */
export const exportDashboardPDF = async (req, res) => {
  try {
    const { userRole, userId } = req.user;
    const { sections = "all", includeCharts = false } = req.query;

    // Get dashboard data
    const dashboardData = await getDashboardDataForExport(req);

    // Create PDF document
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const filename = `dashboard-report-${userRole}-${
      new Date().toISOString().split("T")[0]
    }.pdf`;

    // Set response headers
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    // Pipe PDF to response
    doc.pipe(res);

    // Add title page
    addPDFTitlePage(doc, userRole, req.user.name || "User");

    // Add overview section
    if (sections === "all" || sections.includes("overview")) {
      addPDFOverviewSection(doc, dashboardData.overview);
    }

    // Add project analytics section
    if (sections === "all" || sections.includes("projects")) {
      addPDFProjectSection(doc, dashboardData.projects);
    }

    // Add query analytics section
    if (sections === "all" || sections.includes("queries")) {
      addPDFQuerySection(doc, dashboardData.queries);
    }

    // Add financial analysis section
    if (sections === "all" || sections.includes("financial")) {
      addPDFFinancialSection(doc, dashboardData.financial);
    }

    // Add performance metrics section
    if (sections === "all" || sections.includes("performance")) {
      addPDFPerformanceSection(doc, dashboardData.performance);
    }

    // Add footer
    addPDFFooter(doc);

    // Finalize PDF
    doc.end();
  } catch (error) {
    console.error("Error exporting dashboard to PDF:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while exporting dashboard data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Export dashboard data to JSON
 * GET /api/dashboard/export/json
 */
export const exportDashboardJSON = async (req, res) => {
  try {
    const { userRole, userId } = req.user;
    const { sections = "all", includeMetadata = true } = req.query;

    // Get dashboard data
    const dashboardData = await getDashboardDataForExport(req);

    // Filter sections if specified
    let exportData = {};
    if (sections === "all") {
      exportData = dashboardData;
    } else {
      const sectionArray = Array.isArray(sections)
        ? sections
        : sections.split(",");
      sectionArray.forEach((section) => {
        if (dashboardData[section]) {
          exportData[section] = dashboardData[section];
        }
      });
    }

    // Add metadata if requested
    if (includeMetadata === "true") {
      exportData.metadata = {
        exportedBy: {
          userId,
          userRole,
          name: req.user.name || "Unknown",
        },
        exportedAt: new Date().toISOString(),
        sections: sections,
        dataFreshness: "export-time",
        version: "1.0",
      };
    }

    const filename = `dashboard-data-${userRole}-${
      new Date().toISOString().split("T")[0]
    }.json`;
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    res.status(200).json({
      success: true,
      data: exportData,
      exportInfo: {
        format: "JSON",
        sections: typeof sections === "string" ? sections.split(",") : sections,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error exporting dashboard to JSON:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while exporting dashboard data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

/**
 * Export dashboard data to CSV
 * GET /api/dashboard/export/csv
 */
export const exportDashboardCSV = async (req, res) => {
  try {
    const { userRole, userId } = req.user;
    const { section = "overview" } = req.query;

    // Get dashboard data
    const dashboardData = await getDashboardDataForExport(req);

    let csvData;
    let filename;

    switch (section) {
      case "overview":
        csvData = convertOverviewToCSV(dashboardData.overview);
        filename = `dashboard-overview-${userRole}-${
          new Date().toISOString().split("T")[0]
        }.csv`;
        break;
      case "projects":
        csvData = convertProjectsToCSV(dashboardData.projects);
        filename = `project-analytics-${userRole}-${
          new Date().toISOString().split("T")[0]
        }.csv`;
        break;
      case "queries":
        csvData = convertQueriesToCSV(dashboardData.queries);
        filename = `query-analytics-${userRole}-${
          new Date().toISOString().split("T")[0]
        }.csv`;
        break;
      case "financial":
        csvData = convertFinancialToCSV(dashboardData.financial);
        filename = `financial-analytics-${userRole}-${
          new Date().toISOString().split("T")[0]
        }.csv`;
        break;
      default:
        throw new Error("Invalid section specified for CSV export");
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csvData);
  } catch (error) {
    console.error("Error exporting dashboard to CSV:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while exporting dashboard data",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Helper functions for getting dashboard data
async function getDashboardDataForExport(req) {
  try {
    // Mock the response objects to capture data
    const mockRes = {
      status: () => mockRes,
      json: (data) => data,
    };

    // Get data from different controllers
    const [overviewData, queryData, archiveData] = await Promise.all([
      getDashboardKPIs(req, mockRes).catch(() => ({ data: {} })),
      getQueryKPIs(req, mockRes).catch(() => ({ data: {} })),
      getArchiveKPIs(req, mockRes).catch(() => ({ data: {} })),
    ]);

    return {
      overview: overviewData.data || {},
      projects: overviewData.data?.projectOverview || {},
      queries: queryData.data || {},
      financial: overviewData.data?.financialOverview || {},
      performance: overviewData.data?.performanceMetrics || {},
      archive: archiveData.data || null,
    };
  } catch (error) {
    console.error("Error getting dashboard data for export:", error);
    return {
      overview: {},
      projects: {},
      queries: {},
      financial: {},
      performance: {},
      archive: null,
    };
  }
}

// Excel sheet creation functions
async function addOverviewSheet(workbook, data) {
  const worksheet = workbook.addWorksheet("Dashboard Overview");

  // Add headers
  worksheet.addRow(["Metric", "Value", "Description"]);

  // Add overview data
  const overviewMetrics = [
    ["Total Projects", data.totalProjects || 0, "Total number of projects"],
    ["Ongoing Projects", data.ongoing || 0, "Projects currently in progress"],
    [
      "Completed Projects",
      data.completed || 0,
      "Successfully completed projects",
    ],
    ["Overdue Projects", data.overdue || 0, "Projects past their deadline"],
    [
      "Total Project Value",
      data.totalProjectValue || 0,
      "Combined value of all projects",
    ],
    [
      "Budget Utilization",
      `${data.budgetUtilizationRate || 0}%`,
      "Percentage of budget utilized",
    ],
    [
      "Average Progress",
      `${data.avgPhysicalProgress || 0}%`,
      "Average physical progress across projects",
    ],
    [
      "Average Financial Progress",
      `${data.avgFinancialProgress || 0}%`,
      "Average financial progress across projects",
    ],
  ];

  overviewMetrics.forEach((metric) => {
    worksheet.addRow(metric);
  });

  // Style the header row
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };

  // Auto-fit columns
  worksheet.columns.forEach((column) => {
    column.width = 20;
  });
}

async function addProjectAnalyticsSheet(workbook, data) {
  const worksheet = workbook.addWorksheet("Project Analytics");

  // Add project status distribution
  worksheet.addRow(["Project Status Distribution"]);
  worksheet.addRow(["Status", "Count", "Percentage"]);

  const statusData = [
    ["Draft Projects", data.draftProjects || 0, ""],
    ["Under Review", data.underReview || 0, ""],
    ["Ongoing", data.ongoing || 0, ""],
    ["Completed", data.completed || 0, ""],
    ["Rejected", data.rejected || 0, ""],
    ["Overdue", data.overdue || 0, ""],
  ];

  const total = statusData.reduce((sum, [, count]) => sum + count, 0);
  statusData.forEach(([status, count]) => {
    const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
    worksheet.addRow([status, count, `${percentage}%`]);
  });

  // Style headers
  worksheet.getRow(1).font = { bold: true, size: 14 };
  worksheet.getRow(2).font = { bold: true };
  worksheet.getRow(2).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  };
}

async function addQueryAnalyticsSheet(workbook, data) {
  const worksheet = workbook.addWorksheet("Query Analytics");

  // Add query overview
  worksheet.addRow(["Query Management Overview"]);
  worksheet.addRow(["Metric", "Value"]);

  const queryMetrics = [
    ["Total Queries", data.overview?.totalQueries || 0],
    ["Active Queries", data.overview?.activeQueries || 0],
    ["Critical Queries", data.overview?.criticalQueries || 0],
    ["Resolution Rate", `${data.overview?.resolutionRate || 0}%`],
    [
      "Average Resolution Time",
      `${data.timeMetrics?.avgResolutionTime || 0} days`,
    ],
    ["Escalation Rate", `${data.escalationMetrics?.escalationRate || 0}%`],
  ];

  queryMetrics.forEach((metric) => {
    worksheet.addRow(metric);
  });

  // Add query distribution by status
  worksheet.addRow([""]); // Empty row
  worksheet.addRow(["Query Status Distribution"]);
  worksheet.addRow(["Status", "Count"]);

  const statusDistribution = data.distribution?.byStatus || {};
  Object.entries(statusDistribution).forEach(([status, count]) => {
    worksheet.addRow([status, count]);
  });

  // Style headers
  worksheet.getRow(1).font = { bold: true, size: 14 };
  worksheet.getRow(2).font = { bold: true };
}

async function addFinancialAnalysisSheet(workbook, data) {
  const worksheet = workbook.addWorksheet("Financial Analysis");

  worksheet.addRow(["Financial Performance Overview"]);
  worksheet.addRow(["Metric", "Value", "Currency"]);

  const financialMetrics = [
    ["Total Project Value", data.totalProjectValue || 0, "INR"],
    ["Total Bills Submitted", data.totalBillsSubmitted || 0, "INR"],
    ["Remaining Budget", data.remainingBudget || 0, "INR"],
    ["Budget Utilization Rate", `${data.budgetUtilizationRate || 0}%`, ""],
    ["Average Project Value", data.avgProjectValue || 0, "INR"],
    ["Projects with Bills", data.projectsWithBills || 0, "Count"],
  ];

  financialMetrics.forEach((metric) => {
    worksheet.addRow(metric);
  });

  // Style and format
  worksheet.getRow(1).font = { bold: true, size: 14 };
  worksheet.getRow(2).font = { bold: true };

  // Format currency columns
  worksheet.getColumn(2).numFmt = "#,##0";
}

async function addPerformanceMetricsSheet(workbook, data) {
  const worksheet = workbook.addWorksheet("Performance Metrics");

  worksheet.addRow(["Performance Indicators"]);
  worksheet.addRow(["Metric", "Value", "Rating"]);

  const performanceMetrics = [
    [
      "On-Time Completion Rate",
      `${data.onTimeCompletionRate || 0}%`,
      getRating(data.onTimeCompletionRate),
    ],
    [
      "Progress Efficiency Rate",
      `${data.progressEfficiencyRate || 0}%`,
      getRating(data.progressEfficiencyRate),
    ],
    [
      "Financial Efficiency Rate",
      `${data.financialEfficiencyRate || 0}%`,
      getRating(data.financialEfficiencyRate),
    ],
    [
      "Recent Activity Rate",
      `${data.recentActivityRate || 0}%`,
      getRating(data.recentActivityRate),
    ],
  ];

  performanceMetrics.forEach((metric) => {
    worksheet.addRow(metric);
  });

  // Style headers
  worksheet.getRow(1).font = { bold: true, size: 14 };
  worksheet.getRow(2).font = { bold: true };
}

async function addArchiveComparisonSheet(workbook, data) {
  const worksheet = workbook.addWorksheet("Archive Comparison");

  worksheet.addRow(["Archive vs Active Projects Comparison"]);
  worksheet.addRow([
    "Metric",
    "Archive Projects",
    "Active Projects",
    "Difference",
  ]);

  // Add comparison data if available
  if (data.overview) {
    const comparisonMetrics = [
      ["Total Projects", data.overview.totalProjects || 0, "N/A", "N/A"],
      [
        "Average Progress",
        `${data.overview.avgPhysicalProgress || 0}%`,
        "N/A",
        "N/A",
      ],
      [
        "Completion Rate",
        `${data.performanceMetrics?.completionRate || 0}%`,
        "N/A",
        "N/A",
      ],
    ];

    comparisonMetrics.forEach((metric) => {
      worksheet.addRow(metric);
    });
  }

  // Style headers
  worksheet.getRow(1).font = { bold: true, size: 14 };
  worksheet.getRow(2).font = { bold: true };
}

// PDF creation functions
function addPDFTitlePage(doc, userRole, userName) {
  doc
    .fontSize(24)
    .text("Project Management Dashboard Report", { align: "center" });
  doc.moveDown();
  doc
    .fontSize(16)
    .text(`Generated for: ${userName} (${userRole})`, { align: "center" });
  doc.text(`Report Date: ${new Date().toLocaleDateString()}`, {
    align: "center",
  });
  doc.addPage();
}

function addPDFOverviewSection(doc, data) {
  doc.fontSize(18).text("Dashboard Overview", { underline: true });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Total Projects: ${data.totalProjects || 0}`);
  doc.text(`Ongoing Projects: ${data.ongoing || 0}`);
  doc.text(`Completed Projects: ${data.completed || 0}`);
  doc.text(`Overdue Projects: ${data.overdue || 0}`);
  doc.text(`Budget Utilization: ${data.budgetUtilizationRate || 0}%`);

  doc.addPage();
}

function addPDFProjectSection(doc, data) {
  doc.fontSize(18).text("Project Analytics", { underline: true });
  doc.moveDown();

  doc.fontSize(14).text("Project Distribution:");
  doc.fontSize(12);
  doc.text(`• Draft Projects: ${data.draftProjects || 0}`);
  doc.text(`• Under Review: ${data.underReview || 0}`);
  doc.text(`• Ongoing: ${data.ongoing || 0}`);
  doc.text(`• Completed: ${data.completed || 0}`);
  doc.text(`• Rejected: ${data.rejected || 0}`);

  doc.addPage();
}

function addPDFQuerySection(doc, data) {
  doc.fontSize(18).text("Query Analytics", { underline: true });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`Total Queries: ${data.overview?.totalQueries || 0}`);
  doc.text(`Active Queries: ${data.overview?.activeQueries || 0}`);
  doc.text(`Resolution Rate: ${data.overview?.resolutionRate || 0}%`);
  doc.text(
    `Average Resolution Time: ${data.timeMetrics?.avgResolutionTime || 0} days`
  );

  doc.addPage();
}

function addPDFFinancialSection(doc, data) {
  doc.fontSize(18).text("Financial Analysis", { underline: true });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(
    `Total Project Value: ₹${(data.totalProjectValue || 0).toLocaleString()}`
  );
  doc.text(
    `Total Bills Submitted: ₹${(
      data.totalBillsSubmitted || 0
    ).toLocaleString()}`
  );
  doc.text(
    `Remaining Budget: ₹${(data.remainingBudget || 0).toLocaleString()}`
  );
  doc.text(`Budget Utilization: ${data.budgetUtilizationRate || 0}%`);

  doc.addPage();
}

function addPDFPerformanceSection(doc, data) {
  doc.fontSize(18).text("Performance Metrics", { underline: true });
  doc.moveDown();

  doc.fontSize(12);
  doc.text(`On-Time Completion Rate: ${data.onTimeCompletionRate || 0}%`);
  doc.text(`Progress Efficiency: ${data.progressEfficiencyRate || 0}%`);
  doc.text(`Financial Efficiency: ${data.financialEfficiencyRate || 0}%`);
  doc.text(`Recent Activity Rate: ${data.recentActivityRate || 0}%`);
}

function addPDFFooter(doc) {
  doc.text(
    `Generated on ${new Date().toLocaleString()}`,
    50,
    doc.page.height - 50,
    {
      align: "center",
    }
  );
}

// CSV conversion functions
function convertOverviewToCSV(data) {
  const headers = ["Metric,Value,Description\n"];
  const rows = [
    `Total Projects,${data.totalProjects || 0},Total number of projects`,
    `Ongoing Projects,${data.ongoing || 0},Projects currently in progress`,
    `Completed Projects,${data.completed || 0},Successfully completed projects`,
    `Budget Utilization,${
      data.budgetUtilizationRate || 0
    }%,Percentage of budget utilized`,
  ];

  return headers + rows.join("\n");
}

function convertProjectsToCSV(data) {
  const headers = ["Status,Count,Percentage\n"];
  const total =
    (data.draftProjects || 0) + (data.ongoing || 0) + (data.completed || 0);
  const rows = [
    `Draft,${data.draftProjects || 0},${
      total > 0 ? Math.round(((data.draftProjects || 0) / total) * 100) : 0
    }%`,
    `Ongoing,${data.ongoing || 0},${
      total > 0 ? Math.round(((data.ongoing || 0) / total) * 100) : 0
    }%`,
    `Completed,${data.completed || 0},${
      total > 0 ? Math.round(((data.completed || 0) / total) * 100) : 0
    }%`,
  ];

  return headers + rows.join("\n");
}

function convertQueriesToCSV(data) {
  const headers = ["Metric,Value\n"];
  const rows = [
    `Total Queries,${data.overview?.totalQueries || 0}`,
    `Active Queries,${data.overview?.activeQueries || 0}`,
    `Resolution Rate,${data.overview?.resolutionRate || 0}%`,
    `Average Resolution Time,${data.timeMetrics?.avgResolutionTime || 0} days`,
  ];

  return headers + rows.join("\n");
}

function convertFinancialToCSV(data) {
  const headers = ["Metric,Value,Currency\n"];
  const rows = [
    `Total Project Value,${data.totalProjectValue || 0},INR`,
    `Total Bills Submitted,${data.totalBillsSubmitted || 0},INR`,
    `Remaining Budget,${data.remainingBudget || 0},INR`,
    `Budget Utilization,${data.budgetUtilizationRate || 0}%,`,
  ];

  return headers + rows.join("\n");
}

// Helper functions
function getRating(value) {
  if (value >= 90) return "Excellent";
  if (value >= 75) return "Good";
  if (value >= 60) return "Satisfactory";
  if (value >= 40) return "Needs Improvement";
  return "Poor";
}

export default {
  exportDashboardExcel,
  exportDashboardPDF,
  exportDashboardJSON,
  exportDashboardCSV,
};
