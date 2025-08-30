import mongoose from "mongoose";
import ArchiveProject from "../../models/archive-project.model.js";
import { generateProjectSummaryPDF } from "../../utils/archive-project-summary-pdf-generator.js";

/**
 * Generate and download project summary PDF with progress updates
 * GET /api/archive-projects/:id/download-summary-pdf
 */
export const generateProjectSummaryPDFController = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      includeProgressHistory = true,
      includeFinancialHistory = true,
      maxProgressUpdates = 10,
      maxFinancialUpdates = 10,
    } = req.query;

    // Validate project ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
        details: {
          providedId: id,
          expectedFormat: "MongoDB ObjectId (24 character hex string)",
        },
      });
    }

    console.log(`Generating PDF summary for project ${id}`);

    // Find the project with all necessary data
    const project = await ArchiveProject.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Archive project not found",
        details: {
          searchedId: id,
          suggestion: "Please verify the project ID and try again",
        },
      });
    }

    // Calculate virtual fields and enhanced project data
    const projectData = project.toJSON();

    // Calculate remaining work value
    const remainingWorkValue = project.remainingWorkValue;

    // Get progress statuses
    const progressStatus = project.progressStatus;
    const financialProgressStatus = project.financialProgressStatus;

    // Calculate financial progress if not set
    const calculatedFinancialProgress = project.calculateFinancialProgress();

    // Create enriched project data
    const enrichedProject = {
      ...projectData,
      remainingWorkValue,
      progressStatus,
      financialProgressStatus,
      financialProgress:
        project.financialProgress || calculatedFinancialProgress,
      progressSummary: {
        physical: {
          percentage: project.progress || 0,
          status: progressStatus,
          lastUpdate: project.lastProgressUpdate,
          totalUpdates: project.totalProgressUpdates,
        },
        financial: {
          percentage: project.financialProgress || calculatedFinancialProgress,
          status: financialProgressStatus,
          lastUpdate: project.lastFinancialProgressUpdate,
          totalUpdates: project.totalFinancialProgressUpdates,
          amountSubmitted: project.billSubmittedAmount,
          amountRemaining: remainingWorkValue,
        },
      },
    };

    // Calculate project metrics
    const projectMetrics = {
      daysFromAAToFWO:
        project.AADated && project.FWODate
          ? Math.ceil(
              (new Date(project.FWODate) - new Date(project.AADated)) /
                (1000 * 60 * 60 * 24)
            )
          : null,
      daysFromFWOToNow: project.FWODate
        ? Math.ceil(
            (new Date() - new Date(project.FWODate)) / (1000 * 60 * 60 * 24)
          )
        : null,
      billSubmissionRate:
        project.workValue > 0
          ? Math.round(
              (project.billSubmittedAmount / project.workValue) * 100 * 100
            ) / 100
          : 0,
      isPhysicallyOverdue:
        project.progress < 100 && project.FWODate
          ? new Date() - new Date(project.FWODate) > 365 * 24 * 60 * 60 * 1000
          : false,
      isFinanciallyOverdue:
        (project.financialProgress || calculatedFinancialProgress) < 100 &&
        project.FWODate
          ? new Date() - new Date(project.FWODate) > 365 * 24 * 60 * 60 * 1000
          : false,
      projectAge: project.createdAt
        ? Math.ceil(
            (new Date() - new Date(project.createdAt)) / (1000 * 60 * 60 * 24)
          )
        : 0,
      progressGap: Math.abs(
        (project.progress || 0) -
          (project.financialProgress || calculatedFinancialProgress)
      ),
      isFullyComplete:
        (project.progress || 0) === 100 &&
        (project.financialProgress || calculatedFinancialProgress) === 100,
    };

    // Get progress history if requested
    let progressHistory = null;
    if (includeProgressHistory === "true" || includeProgressHistory === true) {
      const progressLimit = Math.min(parseInt(maxProgressUpdates) || 10, 20);
      progressHistory = project.getProgressUpdateHistory(1, progressLimit);

      // Calculate summary statistics for progress
      const progressUpdates = project.progressUpdates || [];
      progressHistory.summary = {
        totalUpdates: progressUpdates.length,
        totalProgressIncrease: progressUpdates.reduce(
          (sum, update) => sum + Math.max(0, update.progressDifference),
          0
        ),
        totalProgressDecrease: Math.abs(
          progressUpdates.reduce(
            (sum, update) => sum + Math.min(0, update.progressDifference),
            0
          )
        ),
        totalFilesUploaded: progressUpdates.reduce(
          (sum, update) => sum + (update.supportingDocuments?.length || 0),
          0
        ),
        avgProgressChange:
          progressUpdates.length > 0
            ? Math.round(
                (progressUpdates.reduce(
                  (sum, update) => sum + update.progressDifference,
                  0
                ) /
                  progressUpdates.length) *
                  100
              ) / 100
            : 0,
        lastUpdateDate: project.lastProgressUpdate,
      };
    }

    // Get financial history if requested
    let financialHistory = null;
    if (
      includeFinancialHistory === "true" ||
      includeFinancialHistory === true
    ) {
      const financialLimit = Math.min(parseInt(maxFinancialUpdates) || 10, 20);
      financialHistory = project.getFinancialProgressUpdateHistory(
        1,
        financialLimit
      );

      // Calculate summary statistics for financial progress
      const financialProgressUpdates = project.financialProgressUpdates || [];
      financialHistory.summary = {
        totalUpdates: financialProgressUpdates.length,
        totalAmountIncrease: financialProgressUpdates.reduce(
          (sum, update) => sum + Math.max(0, update.amountDifference),
          0
        ),
        totalAmountDecrease: Math.abs(
          financialProgressUpdates.reduce(
            (sum, update) => sum + Math.min(0, update.amountDifference),
            0
          )
        ),
        totalFilesUploaded: financialProgressUpdates.reduce(
          (sum, update) => sum + (update.supportingDocuments?.length || 0),
          0
        ),
        avgProgressChange:
          financialProgressUpdates.length > 0
            ? Math.round(
                (financialProgressUpdates.reduce(
                  (sum, update) => sum + update.progressDifference,
                  0
                ) /
                  financialProgressUpdates.length) *
                  100
              ) / 100
            : 0,
        avgAmountChange:
          financialProgressUpdates.length > 0
            ? Math.round(
                (financialProgressUpdates.reduce(
                  (sum, update) => sum + update.amountDifference,
                  0
                ) /
                  financialProgressUpdates.length) *
                  100
              ) / 100
            : 0,
        lastUpdateDate: project.lastFinancialProgressUpdate,
      };
    }

    console.log(`Generating PDF with:`, {
      projectId: project._id,
      progressUpdates: progressHistory?.totalUpdates || 0,
      financialUpdates: financialHistory?.totalUpdates || 0,
      includeProgressHistory: includeProgressHistory === "true",
      includeFinancialHistory: includeFinancialHistory === "true",
    });

    // Generate PDF file name
    const fileName = `Project_Summary_${project.projectId}_${
      new Date().toISOString().split("T")[0]
    }.pdf`;

    try {
      // Generate PDF buffer using the updated function
      const pdfBuffer = await generateProjectSummaryPDF(
        enrichedProject,
        progressHistory,
        financialHistory,
        projectMetrics
      );

      // Set response headers for PDF download
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${fileName}"`
      );
      res.setHeader("Content-Length", pdfBuffer.length);
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");

      // Send the PDF buffer directly
      res.send(pdfBuffer);
    } catch (pdfError) {
      console.error("Error generating PDF:", pdfError);

      // Return JSON error response
      res.status(500).json({
        success: false,
        message: "Error generating PDF document",
        details: {
          error: pdfError.message,
          projectId: id,
          suggestion:
            "Please try again. If the problem persists, contact administrator.",
        },
      });
    }
  } catch (error) {
    console.error("Error in generateProjectSummaryPDFController:", error);

    // Handle specific errors
    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
        details: {
          providedId: req.params.id,
          error: error.message,
          expectedFormat: "MongoDB ObjectId (24 character hex string)",
        },
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while generating project summary PDF",
      details: {
        projectId: req.params.id,
        timestamp: new Date().toISOString(),
      },
      error:
        process.env.NODE_ENV === "development"
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : undefined,
    });
  }
};

/**
 * Get PDF generation status and options
 * GET /api/archive-projects/:id/pdf-options
 */
export const getPDFGenerationOptions = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
      });
    }

    const project = await ArchiveProject.findById(id);

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Archive project not found",
      });
    }

    const options = {
      projectInfo: {
        id: project._id,
        name: project.nameOfWork,
        projectId: project.projectId,
        contractor: project.nameOfContractor,
        financialYear: project.financialYear,
      },
      availableOptions: {
        includeProgressHistory: {
          available:
            project.progressUpdates && project.progressUpdates.length > 0,
          count: project.progressUpdates?.length || 0,
          maxRecommended: 10,
          maxAllowed: 20,
        },
        includeFinancialHistory: {
          available:
            project.financialProgressUpdates &&
            project.financialProgressUpdates.length > 0,
          count: project.financialProgressUpdates?.length || 0,
          maxRecommended: 10,
          maxAllowed: 20,
        },
      },
      estimatedPdfSize: {
        baseSections: "2-3 pages",
        withProgressHistory:
          project.progressUpdates?.length > 0
            ? `+${Math.ceil(project.progressUpdates.length * 0.3)} pages`
            : "+0 pages",
        withFinancialHistory:
          project.financialProgressUpdates?.length > 0
            ? `+${Math.ceil(
                project.financialProgressUpdates.length * 0.4
              )} pages`
            : "+0 pages",
      },
      lastUpdated: {
        physicalProgress: project.lastProgressUpdate,
        financialProgress: project.lastFinancialProgressUpdate,
        projectData: project.updatedAt,
      },
    };

    res.status(200).json({
      success: true,
      message: "PDF generation options retrieved successfully",
      data: options,
    });
  } catch (error) {
    console.error("Error getting PDF generation options:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred while retrieving PDF options",
    });
  }
};

/**
 * Generate PDF summary for multiple projects (Bulk operation)
 * POST /api/archive-projects/bulk/generate-summary-pdf
 */
export const generateBulkProjectSummaryPDF = async (req, res) => {
  try {
    const { projectIds, options = {} } = req.body;
    const user = req.user;

    // Validation
    if (!Array.isArray(projectIds) || projectIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Project IDs array is required and cannot be empty",
      });
    }

    if (projectIds.length > 20) {
      return res.status(400).json({
        success: false,
        message: "Maximum 20 projects can be processed in one bulk operation",
      });
    }

    // Validate all project IDs
    const invalidIds = projectIds.filter(
      (id) => !mongoose.Types.ObjectId.isValid(id)
    );
    if (invalidIds.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
        details: {
          invalidIds,
          validFormat: "MongoDB ObjectId (24 character hex string)",
        },
      });
    }

    // Find all projects
    const projects = await ArchiveProject.find({
      _id: { $in: projectIds },
    });

    const foundIds = projects.map((p) => p._id.toString());
    const notFoundIds = projectIds.filter((id) => !foundIds.includes(id));

    if (notFoundIds.length > 0) {
      return res.status(404).json({
        success: false,
        message: "Some projects were not found",
        details: {
          notFoundIds,
          foundCount: projects.length,
          requestedCount: projectIds.length,
        },
      });
    }

    // Generate individual PDFs for each project
    const results = [];
    const errors = [];

    for (const project of projects) {
      try {
        // Use the same logic as single PDF generation
        const enrichedProject = {
          ...project.toJSON(),
          remainingWorkValue: project.remainingWorkValue,
          progressStatus: project.progressStatus,
          financialProgressStatus: project.financialProgressStatus,
          progressSummary: {
            physical: {
              percentage: project.progress || 0,
              status: project.progressStatus,
              lastUpdate: project.lastProgressUpdate,
              totalUpdates: project.totalProgressUpdates,
            },
            financial: {
              percentage:
                project.financialProgress ||
                project.calculateFinancialProgress(),
              status: project.financialProgressStatus,
              lastUpdate: project.lastFinancialProgressUpdate,
              totalUpdates: project.totalFinancialProgressUpdates,
              amountSubmitted: project.billSubmittedAmount,
              amountRemaining: project.remainingWorkValue,
            },
          },
        };

        const projectMetrics = {
          projectAge: project.createdAt
            ? Math.ceil(
                (new Date() - new Date(project.createdAt)) /
                  (1000 * 60 * 60 * 24)
              )
            : 0,
          isFullyComplete:
            (project.progress || 0) === 100 &&
            (project.financialProgress || 0) === 100,
        };

        // For bulk operations, limit history to reduce processing time
        const progressHistory =
          options.includeProgressHistory !== false
            ? project.getProgressUpdateHistory(1, 5)
            : null;
        const financialHistory =
          options.includeFinancialHistory !== false
            ? project.getFinancialProgressUpdateHistory(1, 5)
            : null;

        await generateProjectSummaryPDF(
          enrichedProject,
          progressHistory,
          financialHistory,
          projectMetrics
        );

        results.push({
          projectId: project._id,
          projectName: project.nameOfWork,
          status: "generated",
          fileName: `Project_Summary_${project.projectId}_${
            new Date().toISOString().split("T")[0]
          }.pdf`,
        });
      } catch (error) {
        console.error(
          `Error generating PDF for project ${project._id}:`,
          error
        );
        errors.push({
          projectId: project._id,
          projectName: project.nameOfWork,
          error: error.message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Bulk PDF generation completed. ${results.length} successful, ${errors.length} failed`,
      data: {
        successful: results,
        failed: errors,
        summary: {
          total: projects.length,
          successful: results.length,
          failed: errors.length,
          generatedAt: new Date().toISOString(),
          generatedBy: {
            userId: user.id,
            userName: user.name || user.username,
            userDesignation: user.designation,
          },
        },
      },
    });
  } catch (error) {
    console.error("Error in bulk PDF generation:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error occurred during bulk PDF generation",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

export default {
  generateProjectSummaryPDFController,
  getPDFGenerationOptions,
  generateBulkProjectSummaryPDF,
};
