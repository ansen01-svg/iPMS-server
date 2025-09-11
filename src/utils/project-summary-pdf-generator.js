import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Generate project summary PDF with progress updates
 * @param {Object} projectData - Complete project data with updates
 * @param {Object} progressHistory - Physical progress update history with pagination info
 * @param {Object} financialHistory - Financial progress update history with pagination info
 * @param {Object} metrics - Project metrics and calculations
 * @returns {Promise<Buffer>} - PDF buffer for server-side response
 */
export const generateProjectSummaryPDF = async (
  projectData,
  progressHistory = null,
  financialHistory = null,
  metrics = {}
) => {
  try {
    // Import jsPDF dynamically with correct syntax for different versions
    let jsPDF;
    try {
      // Try the most common import patterns
      const jsPDFModule = await import("jspdf");

      // Handle different export patterns
      if (jsPDFModule.default) {
        if (typeof jsPDFModule.default === "function") {
          jsPDF = jsPDFModule.default;
        } else if (jsPDFModule.default.jsPDF) {
          jsPDF = jsPDFModule.default.jsPDF;
        }
      } else if (jsPDFModule.jsPDF) {
        jsPDF = jsPDFModule.jsPDF;
      } else {
        jsPDF = jsPDFModule;
      }

      // Fallback: try to find the constructor
      if (!jsPDF || typeof jsPDF !== "function") {
        throw new Error("Unable to find jsPDF constructor");
      }
    } catch (importError) {
      console.error("jsPDF import error:", importError);
      throw new Error(`Failed to import jsPDF: ${importError.message}`);
    }

    const doc = new jsPDF();

    // Set up document styling
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const headerHeight = 50;
    const footerHeight = 20;
    let yPosition = margin + headerHeight + 10; // Start after header
    let currentPage = 1;

    // Load and convert logo to base64
    const loadImageAsBase64 = async () => {
      try {
        // Construct path to logo - adjust this path based on your project structure
        const logoPath = path.join(
          __dirname,
          "../../public/assets/images/aptdcl-logo.jpg"
        );

        // Check if file exists
        if (!fs.existsSync(logoPath)) {
          console.warn(`Logo file not found at: ${logoPath}`);
          return "";
        }

        // Read file as base64
        const imageBuffer = fs.readFileSync(logoPath);
        const base64Image = imageBuffer.toString("base64");
        const mimeType = "image/jpeg"; // Adjust if your logo is PNG

        return `data:${mimeType};base64,${base64Image}`;
      } catch (error) {
        console.warn("Could not load logo image:", error.message);
        return "";
      }
    };

    // Load the logo
    const logoBase64 = await loadImageAsBase64();

    // Helper function to add header (only once at the beginning)
    const addHeader = () => {
      const headerY = 15;
      const logoSize = 25;
      const logoX = margin;

      // Add logo if available
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, "JPEG", logoX, headerY, logoSize, logoSize);
        } catch (error) {
          console.warn("Error adding logo to PDF:", error);
        }
      }

      // Add company name and subtitle
      const textStartX = logoBase64 ? logoX + logoSize + 10 : logoX;

      // Company name
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(180, 50, 100);
      doc.text("ASSAM PLAINS TRIBES DEVELOPMENT", textStartX, headerY + 8);
      doc.text("CORPORATION LIMITED", textStartX, headerY + 16);

      // Subtitle
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text("A GOVERNMENT OF ASSAM UNDERTAKING", textStartX, headerY + 24);

      // Reset text color to black for content
      doc.setTextColor(0, 0, 0);

      // Add a line separator
      doc.setLineWidth(0.5);
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, headerY + 35, pageWidth - margin, headerY + 35);
    };

    // Helper function to add footer to current page
    const addFooter = () => {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);

      doc.text(`Page ${currentPage}`, pageWidth / 2, pageHeight - 10, {
        align: "center",
      });

      doc.text(
        `Generated on ${new Date().toLocaleDateString("en-IN")}`,
        pageWidth - margin,
        pageHeight - 10,
        { align: "right" }
      );

      doc.setTextColor(0, 0, 0);
    };

    // Helper function to add new page if needed
    const checkNewPage = (requiredHeight) => {
      if (yPosition + requiredHeight > pageHeight - footerHeight - margin) {
        addFooter();
        doc.addPage();
        currentPage++;
        yPosition = margin + 20; // Start from top on new pages (no header)
        return true;
      }
      return false;
    };

    // Helper function to format currency
    const formatCurrency = (amount) => {
      if (amount === null || amount === undefined) return "0.00 INR";
      return (
        new Intl.NumberFormat("en-IN", {
          style: "decimal",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(amount) + " INR"
      );
    };

    // Helper function to format date
    const formatDate = (dateString) => {
      if (!dateString) return "Not specified";
      try {
        return new Date(dateString).toLocaleDateString("en-IN", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });
      } catch (error) {
        return "Invalid date";
      }
    };

    // Helper function to format date with time
    const formatDateTime = (dateString) => {
      if (!dateString) return "Not specified";
      try {
        return new Date(dateString).toLocaleString("en-IN", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (error) {
        return "Invalid date";
      }
    };

    // Add header to first page only
    addHeader();

    // Document Title
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("PROJECT SUMMARY & PROGRESS REPORT", pageWidth / 2, yPosition, {
      align: "center",
    });
    yPosition += 15;

    // Project ID and Generation Date
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Project ID: ${projectData.projectId}`, margin, yPosition);
    doc.text(
      `Report Generated: ${formatDateTime(new Date())}`,
      pageWidth - margin,
      yPosition,
      { align: "right" }
    );
    yPosition += 15;

    // Basic Project Information Section
    checkNewPage(100);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 139); // Dark blue for section headers
    doc.text("PROJECT OVERVIEW", margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const basicInfo = [
      ["Project Name:", projectData.projectName || "N/A"],
      ["Description:", projectData.description || "No description provided"],
      ["Contractor Name:", projectData.contractorName || "N/A"],
      ["Contractor Address:", projectData.contractorAddress || "N/A"],
      ["Contractor Phone:", projectData.contractorPhoneNumber || "N/A"],
      ["Work Order Number:", projectData.workOrderNumber || "N/A"],
      ["Work Order Date:", formatDate(projectData.dateOfIssueOfWorkOrder)],
      ["Estimated Cost:", formatCurrency(projectData.estimatedCost)],
      [
        "Fund:",
        projectData.fundDetails?.fullName ||
          `${projectData.fund} - ${projectData.subFund}`,
      ],
      ["Sanctioning Department:", projectData.sanctioningDepartment || "N/A"],
      ["Budget Head:", projectData.budgetHead || "N/A"],
      ["Executing Department:", projectData.executingDepartment || "APTDCL"],
      ["Beneficiary:", projectData.beneficiary || "N/A"],
      ["Type of Work:", projectData.typeOfWork || "N/A"],
      ["District:", projectData.district || "N/A"],
      ["Block:", projectData.block || "N/A"],
      ["Gram Panchayat:", projectData.gramPanchayat || "N/A"],
      ["Project Start Date:", formatDate(projectData.projectStartDate)],
      ["Project End Date:", formatDate(projectData.projectEndDate)],
      [
        "Extension Period:",
        formatDate(projectData.extensionPeriodForCompletion),
      ],
      ["Project Duration:", `${metrics.projectDurationDays || 0} days`],
      ["Has Sub Projects:", projectData.hasSubProjects ? "Yes" : "No"],
      ["Sub Projects Count:", `${metrics.subProjectsCount || 0} projects`],
      [
        "Total Sub Projects Cost:",
        formatCurrency(metrics.totalSubProjectsCost || 0),
      ],
      ["Project Status:", projectData.status || "Unknown"],
      [
        "Created By:",
        `${projectData.createdBy?.name || "Unknown"} (${
          projectData.createdBy?.role || "N/A"
        })`,
      ],
    ];

    basicInfo.forEach(([label, value]) => {
      checkNewPage(8);
      doc.setFont("helvetica", "bold");
      doc.text(label, margin, yPosition);
      doc.setFont("helvetica", "normal");

      const lines = doc.splitTextToSize(value, pageWidth - margin - 100);
      doc.text(lines, margin + 90, yPosition);
      yPosition += Math.max(8, lines.length * 5);
    });

    yPosition += 10;

    // Sub Projects Section (if any)
    if (
      projectData.hasSubProjects &&
      projectData.subProjects &&
      projectData.subProjects.length > 0
    ) {
      checkNewPage(40);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 139);
      doc.text("SUB PROJECTS", margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 10;

      projectData.subProjects.forEach((subProject, index) => {
        checkNewPage(30);

        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(34, 139, 34);
        doc.text(`Sub Project ${index + 1}:`, margin, yPosition);
        doc.setTextColor(0, 0, 0);
        yPosition += 8;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");

        const subProjectInfo = [
          ["Name:", subProject.projectName || "N/A"],
          ["Estimated Amount:", formatCurrency(subProject.estimatedAmount)],
          ["Type of Work:", subProject.typeOfWork || "N/A"],
          ["Start Date:", formatDate(subProject.projectStartDate)],
          ["End Date:", formatDate(subProject.projectEndDate)],
          [
            "Extension Period:",
            formatDate(subProject.extensionPeriodForCompletion),
          ],
        ];

        subProjectInfo.forEach(([label, value]) => {
          checkNewPage(6);
          doc.setFont("helvetica", "bold");
          doc.text(label, margin + 10, yPosition);
          doc.setFont("helvetica", "normal");
          doc.text(value, margin + 100, yPosition);
          yPosition += 6;
        });

        yPosition += 5;
      });

      yPosition += 10;
    }

    // Progress Summary Section
    checkNewPage(80);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 139);
    doc.text("PROGRESS SUMMARY", margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    // Physical Progress
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(34, 139, 34); // Forest green
    doc.text("Physical Progress:", margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const physicalProgressInfo = [
      ["Current Progress:", `${projectData.progressPercentage || 0}%`],
      [
        "Status:",
        projectData.progressSummary?.physical?.status || "Not Started",
      ],
      [
        "Last Updated:",
        formatDateTime(projectData.progressSummary?.physical?.lastUpdate),
      ],
      ["Total Updates:", `${projectData.totalProgressUpdates || 0} updates`],
    ];

    physicalProgressInfo.forEach(([label, value]) => {
      checkNewPage(8);
      doc.setFont("helvetica", "bold");
      doc.text(label, margin + 10, yPosition);
      doc.setFont("helvetica", "normal");
      doc.text(value, margin + 90, yPosition);
      yPosition += 6;
    });

    yPosition += 8;

    // Financial Progress
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(139, 69, 19); // Saddle brown
    doc.text("Financial Progress:", margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 8;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const financialProgressInfo = [
      ["Financial Progress:", `${projectData.financialProgress || 0}%`],
      [
        "Status:",
        projectData.progressSummary?.financial?.status || "Not Started",
      ],
      ["Bill Submitted:", formatCurrency(projectData.billSubmittedAmount || 0)],
      [
        "Amount Remaining:",
        formatCurrency(
          projectData.remainingWorkValue || projectData.estimatedCost
        ),
      ],
      [
        "Last Updated:",
        formatDateTime(projectData.progressSummary?.financial?.lastUpdate),
      ],
      [
        "Total Updates:",
        `${projectData.totalFinancialProgressUpdates || 0} updates`,
      ],
    ];

    financialProgressInfo.forEach(([label, value]) => {
      checkNewPage(8);
      doc.setFont("helvetica", "bold");
      doc.text(label, margin + 10, yPosition);
      doc.setFont("helvetica", "normal");
      doc.text(value, margin + 90, yPosition);
      yPosition += 6;
    });

    yPosition += 10;

    // Project Metrics Section
    if (metrics && Object.keys(metrics).length > 0) {
      checkNewPage(60);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 139);
      doc.text("PROJECT METRICS", margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const metricsInfo = [
        ["Project Age:", `${metrics.projectAge || 0} days`],
        ["Project Duration:", `${metrics.projectDurationDays || 0} days`],
        [
          "Days from Start to End:",
          metrics.daysFromStartToEnd
            ? `${metrics.daysFromStartToEnd} days`
            : "N/A",
        ],
        [
          "Days from Start to Now:",
          metrics.daysFromStartToNow
            ? `${metrics.daysFromStartToNow} days`
            : "N/A",
        ],
        ["Bill Submission Rate:", `${metrics.billSubmissionRate || 0}%`],
        ["Progress Gap:", `${metrics.progressGap || 0}%`],
        ["Fully Complete:", metrics.isFullyComplete ? "Yes" : "No"],
        ["Physically Overdue:", metrics.isPhysicallyOverdue ? "Yes" : "No"],
        ["Financially Overdue:", metrics.isFinanciallyOverdue ? "Yes" : "No"],
        ["Has Sub Projects:", metrics.hasSubProjects ? "Yes" : "No"],
        ["Sub Projects Count:", `${metrics.subProjectsCount || 0}`],
        [
          "Total Sub Projects Cost:",
          formatCurrency(metrics.totalSubProjectsCost || 0),
        ],
      ];

      metricsInfo.forEach(([label, value]) => {
        checkNewPage(8);
        doc.setFont("helvetica", "bold");
        doc.text(label, margin, yPosition);
        doc.setFont("helvetica", "normal");
        doc.text(value, margin + 90, yPosition);
        yPosition += 6;
      });

      yPosition += 10;
    }

    // Uploaded Files Section
    if (projectData.uploadedFiles && projectData.uploadedFiles.length > 0) {
      checkNewPage(40);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 139);
      doc.text("UPLOADED FILES", margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 10;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Total Files: ${projectData.uploadedFiles.length}`,
        margin,
        yPosition
      );
      yPosition += 8;

      projectData.uploadedFiles.forEach((file, index) => {
        checkNewPage(15);

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`File ${index + 1}:`, margin, yPosition);
        yPosition += 6;

        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        const fileInfo = [
          [`Name:`, file.fileName || "Unknown"],
          [`Type:`, file.fileType || "Unknown"],
          [
            `Size:`,
            file.fileSize
              ? `${Math.round(file.fileSize / 1024)} KB`
              : "Unknown",
          ],
          [`Uploaded:`, formatDateTime(file.uploadedAt)],
          [`Uploaded By:`, file.uploadedBy?.name || "Unknown"],
        ];

        fileInfo.forEach(([label, value]) => {
          checkNewPage(5);
          doc.setFont("helvetica", "bold");
          doc.text(label, margin + 5, yPosition);
          doc.setFont("helvetica", "normal");
          doc.text(value, margin + 50, yPosition);
          yPosition += 4;
        });

        yPosition += 3;
      });

      yPosition += 10;
    }

    // Physical Progress Updates History
    if (
      progressHistory &&
      progressHistory.updates &&
      progressHistory.updates.length > 0
    ) {
      checkNewPage(40);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 139);
      doc.text("PHYSICAL PROGRESS UPDATES HISTORY", margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 10;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Showing ${progressHistory.updates.length} most recent updates (of ${progressHistory.totalUpdates} total):`,
        margin,
        yPosition
      );
      yPosition += 8;

      progressHistory.updates.forEach((update, index) => {
        checkNewPage(25);

        // Update header
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Update #${index + 1}`, margin, yPosition);
        doc.setFont("helvetica", "normal");
        doc.text(
          formatDateTime(update.createdAt),
          pageWidth - margin,
          yPosition,
          { align: "right" }
        );
        yPosition += 8;

        // Update details
        doc.setFontSize(9);
        const updateInfo = [
          [
            `Progress Change:`,
            `${update.previousProgress || 0}% → ${update.newProgress || 0}% (${
              update.progressDifference > 0 ? "+" : ""
            }${update.progressDifference || 0}%)`,
          ],
          [
            `Updated By:`,
            `${update.updatedBy?.userName || "Unknown"} (${
              update.updatedBy?.userDesignation || "N/A"
            })`,
          ],
          [`Remarks:`, update.remarks || "No remarks provided"],
          [
            `Supporting Files:`,
            `${update.supportingDocuments?.length || 0} files`,
          ],
        ];

        updateInfo.forEach(([label, value]) => {
          checkNewPage(6);
          doc.setFont("helvetica", "bold");
          doc.text(label, margin + 5, yPosition);
          doc.setFont("helvetica", "normal");
          const lines = doc.splitTextToSize(value, pageWidth - margin - 100);
          doc.text(lines, margin + 80, yPosition);
          yPosition += Math.max(5, lines.length * 4);
        });

        yPosition += 3;
      });

      yPosition += 10;
    }

    // Financial Progress Updates History
    if (
      financialHistory &&
      financialHistory.updates &&
      financialHistory.updates.length > 0
    ) {
      checkNewPage(40);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 139);
      doc.text("FINANCIAL PROGRESS UPDATES HISTORY", margin, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += 10;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Showing ${financialHistory.updates.length} most recent updates (of ${financialHistory.totalUpdates} total):`,
        margin,
        yPosition
      );
      yPosition += 8;

      financialHistory.updates.forEach((update, index) => {
        checkNewPage(30);

        // Update header
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Update #${index + 1}`, margin, yPosition);
        doc.setFont("helvetica", "normal");
        doc.text(
          formatDateTime(update.createdAt),
          pageWidth - margin,
          yPosition,
          { align: "right" }
        );
        yPosition += 8;

        // Update details
        doc.setFontSize(9);
        const updateInfo = [
          [
            `Progress Change:`,
            `${update.previousFinancialProgress || 0}% → ${
              update.newFinancialProgress || 0
            }% (${update.progressDifference > 0 ? "+" : ""}${
              update.progressDifference || 0
            }%)`,
          ],
          [
            `Bill Amount Change:`,
            `${formatCurrency(update.previousBillAmount)} → ${formatCurrency(
              update.newBillAmount
            )} (${update.amountDifference > 0 ? "+" : ""}${formatCurrency(
              Math.abs(update.amountDifference || 0)
            )})`,
          ],
          [
            `Updated By:`,
            `${update.updatedBy?.userName || "Unknown"} (${
              update.updatedBy?.userDesignation || "N/A"
            })`,
          ],
          [
            `Bill Details:`,
            update.billDetails?.billNumber
              ? `Bill No: ${update.billDetails.billNumber}`
              : "No bill details",
          ],
          [`Remarks:`, update.remarks || "No remarks provided"],
          [
            `Supporting Files:`,
            `${update.supportingDocuments?.length || 0} files`,
          ],
        ];

        updateInfo.forEach(([label, value]) => {
          checkNewPage(6);
          doc.setFont("helvetica", "bold");
          doc.text(label, margin + 5, yPosition);
          doc.setFont("helvetica", "normal");
          const lines = doc.splitTextToSize(value, pageWidth - margin - 100);
          doc.text(lines, margin + 80, yPosition);
          yPosition += Math.max(5, lines.length * 4);
        });

        yPosition += 3;
      });

      yPosition += 10;
    }

    // Summary Statistics
    checkNewPage(50);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 139);
    doc.text("SUMMARY STATISTICS", margin, yPosition);
    doc.setTextColor(0, 0, 0);
    yPosition += 10;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const summaryStats = [
      ["Total Physical Updates:", `${progressHistory?.totalUpdates || 0}`],
      ["Total Financial Updates:", `${financialHistory?.totalUpdates || 0}`],
      [
        "Total Files in Updates:",
        `${
          (progressHistory?.summary?.totalFilesUploaded || 0) +
          (financialHistory?.summary?.totalFilesUploaded || 0)
        }`,
      ],
      ["Total Project Files:", `${projectData.uploadedFiles?.length || 0}`],
      [
        "Average Progress Change:",
        `${progressHistory?.summary?.avgProgressChange || 0}%`,
      ],
      [
        "Average Amount Change:",
        formatCurrency(financialHistory?.summary?.avgAmountChange || 0),
      ],
      ["Project Created:", formatDateTime(projectData.createdAt)],
      ["Last Modified:", formatDateTime(projectData.updatedAt)],
      ["Report Generation Date:", formatDateTime(new Date())],
    ];

    summaryStats.forEach(([label, value]) => {
      checkNewPage(8);
      doc.setFont("helvetica", "bold");
      doc.text(label, margin, yPosition);
      doc.setFont("helvetica", "normal");
      doc.text(value, margin + 120, yPosition);
      yPosition += 8;
    });

    // Add footer to the current/last page
    addFooter();

    // Update page numbers for all pages
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);

      // Update page number to show total
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, {
        align: "center",
      });
    }

    // For server-side usage, return PDF buffer instead of calling doc.save()
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    console.log(`PDF generated successfully: ${pdfBuffer.length} bytes`);

    return pdfBuffer;
  } catch (error) {
    console.error("Error generating project summary PDF:", error);
    throw new Error(`Failed to generate project summary PDF: ${error.message}`);
  }
};

export default generateProjectSummaryPDF;
