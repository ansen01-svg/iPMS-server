import ArchiveProject from "../../models/archive-project.model.js";

/**
 * Get all documents for a specific archive project grouped by category
 * GET /api/archive-projects/:projectId/documents
 */
export const getArchiveProjectDocuments = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID must be provided",
      });
    }

    // Find archive project with all document-related fields
    const project = await ArchiveProject.findOne({ projectId }).select(
      "projectId nameOfWork progressUpdates financialProgressUpdates queries nameOfContractor location concernedEngineer financialYear"
    );

    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Archive project not found",
        details: {
          searchedId: projectId,
          suggestion: "Please verify the project ID and try again",
        },
      });
    }

    // Helper function to format file size
    const formatFileSize = (bytes) => {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    // Helper function to get file extension
    const getFileExtension = (fileName) => {
      return fileName.split(".").pop().toLowerCase();
    };

    // 1. General Project Documents (empty for archive projects)
    const projectDocuments = [];

    // 2. Physical Progress Documents
    const physicalProgressDocuments = [];
    project.progressUpdates?.forEach((update, updateIndex) => {
      update.supportingDocuments?.forEach((doc, docIndex) => {
        physicalProgressDocuments.push({
          id: doc._id,
          fileName: doc.fileName,
          originalName: doc.originalName,
          fileType: doc.fileType,
          fileExtension: getFileExtension(doc.fileName),
          fileSize: doc.fileSize,
          formattedFileSize: formatFileSize(doc.fileSize),
          downloadURL: doc.downloadURL,
          filePath: doc.filePath,
          uploadedAt: doc.uploadedAt,
          category: "Progress Document",
          subcategory: "Physical Progress",
          documentIndex: docIndex + 1,
          additionalInfo: {
            projectName: project.nameOfWork,
            projectId: project.projectId,
            progressUpdateIndex: updateIndex + 1,
            progressUpdateId: update._id,
            progressUpdateDate: update.createdAt,
            previousProgress: update.previousProgress,
            newProgress: update.newProgress,
            progressDifference: update.progressDifference,
            updatedBy: update.updatedBy,
            remarks: update.remarks,
            financialYear: project.financialYear,
            concernedEngineer: project.concernedEngineer,
          },
        });
      });
    });

    // 3. Financial Progress Documents
    const financialProgressDocuments = [];
    project.financialProgressUpdates?.forEach((update, updateIndex) => {
      update.supportingDocuments?.forEach((doc, docIndex) => {
        financialProgressDocuments.push({
          id: doc._id,
          fileName: doc.fileName,
          originalName: doc.originalName,
          fileType: doc.fileType,
          fileExtension: getFileExtension(doc.fileName),
          fileSize: doc.fileSize,
          formattedFileSize: formatFileSize(doc.fileSize),
          downloadURL: doc.downloadURL,
          filePath: doc.filePath,
          uploadedAt: doc.uploadedAt,
          category: "Progress Document",
          subcategory: "Financial Progress",
          documentIndex: docIndex + 1,
          additionalInfo: {
            projectName: project.nameOfWork,
            projectId: project.projectId,
            financialUpdateIndex: updateIndex + 1,
            financialUpdateId: update._id,
            financialUpdateDate: update.createdAt,
            previousFinancialProgress: update.previousFinancialProgress,
            newFinancialProgress: update.newFinancialProgress,
            progressDifference: update.progressDifference,
            previousBillAmount: update.previousBillAmount,
            newBillAmount: update.newBillAmount,
            amountDifference: update.amountDifference,
            billDetails: update.billDetails,
            updatedBy: update.updatedBy,
            remarks: update.remarks,
            financialYear: project.financialYear,
            concernedEngineer: project.concernedEngineer,
          },
        });
      });
    });

    // 4. Query Documents
    const queryDocuments = [];
    project.queries?.forEach((query, queryIndex) => {
      // Only process active queries
      if (query.isActive) {
        query.attachments?.forEach((attachment, attachmentIndex) => {
          queryDocuments.push({
            id: attachment._id,
            fileName: attachment.fileName,
            originalName: attachment.originalName,
            fileType: attachment.fileType,
            fileExtension: getFileExtension(attachment.fileName),
            fileSize: attachment.fileSize,
            formattedFileSize: formatFileSize(attachment.fileSize),
            downloadURL: attachment.downloadURL,
            filePath: attachment.filePath,
            uploadedAt: attachment.uploadedAt,
            uploadedBy: attachment.uploadedBy,
            category: "Query Document",
            subcategory: query.queryCategory,
            documentIndex: attachmentIndex + 1,
            additionalInfo: {
              projectName: project.nameOfWork,
              projectId: project.projectId,
              queryIndex: queryIndex + 1,
              queryId: query.queryId,
              queryTitle: query.queryTitle,
              queryDescription: query.queryDescription,
              queryCategory: query.queryCategory,
              queryPriority: query.priority,
              queryStatus: query.status,
              raisedBy: query.raisedBy,
              raisedDate: query.raisedDate,
              assignedTo: query.assignedTo,
              escalationLevel: query.escalationLevel,
              financialYear: project.financialYear,
              concernedEngineer: project.concernedEngineer,
            },
          });
        });
      }
    });

    // Calculate summary statistics
    const totalDocuments =
      projectDocuments.length +
      physicalProgressDocuments.length +
      financialProgressDocuments.length +
      queryDocuments.length;

    const documentsByType = {
      images: 0,
      documents: 0,
      pdfs: 0,
      spreadsheets: 0,
      others: 0,
    };

    const allDocuments = [
      ...projectDocuments,
      ...physicalProgressDocuments,
      ...financialProgressDocuments,
      ...queryDocuments,
    ];

    allDocuments.forEach((doc) => {
      const ext = doc.fileExtension.toLowerCase();
      if (["jpg", "jpeg", "png", "gif", "bmp", "svg"].includes(ext)) {
        documentsByType.images++;
      } else if (["pdf"].includes(ext)) {
        documentsByType.pdfs++;
      } else if (["doc", "docx"].includes(ext)) {
        documentsByType.documents++;
      } else if (["xls", "xlsx", "csv"].includes(ext)) {
        documentsByType.spreadsheets++;
      } else {
        documentsByType.others++;
      }
    });

    const totalFileSize = allDocuments.reduce(
      (total, doc) => total + doc.fileSize,
      0
    );

    // Construct response
    res.status(200).json({
      success: true,
      message: "Archive project documents retrieved successfully",
      data: {
        projectInfo: {
          projectId: project.projectId,
          projectName: project.nameOfWork,
          contractorName: project.nameOfContractor,
          location: project.location,
          concernedEngineer: project.concernedEngineer,
          financialYear: project.financialYear,
        },
        documentGroups: {
          projectDocuments: {
            label: "General Project Documents",
            description:
              "Documents uploaded during project creation or general project files",
            count: projectDocuments.length,
            documents: projectDocuments,
          },
          physicalProgressDocuments: {
            label: "Physical Progress Documents",
            description:
              "Supporting documents for physical/work progress updates",
            count: physicalProgressDocuments.length,
            documents: physicalProgressDocuments,
          },
          financialProgressDocuments: {
            label: "Financial Progress Documents",
            description:
              "Supporting documents for financial progress and bill submissions",
            count: financialProgressDocuments.length,
            documents: financialProgressDocuments,
          },
          queryDocuments: {
            label: "Query Related Documents",
            description: "Attachments and supporting files for project queries",
            count: queryDocuments.length,
            documents: queryDocuments,
          },
        },
        summary: {
          totalDocuments,
          totalFileSize,
          formattedTotalFileSize: formatFileSize(totalFileSize),
          documentsByCategory: {
            projectDocuments: projectDocuments.length,
            physicalProgressDocuments: physicalProgressDocuments.length,
            financialProgressDocuments: financialProgressDocuments.length,
            queryDocuments: queryDocuments.length,
          },
          documentsByType,
          oldestDocument:
            allDocuments.length > 0
              ? allDocuments.reduce((oldest, doc) =>
                  doc.uploadedAt < oldest.uploadedAt ? doc : oldest
                )
              : null,
          newestDocument:
            allDocuments.length > 0
              ? allDocuments.reduce((newest, doc) =>
                  doc.uploadedAt > newest.uploadedAt ? doc : newest
                )
              : null,
        },
      },
      metadata: {
        retrievedAt: new Date().toISOString(),
        projectId: project._id,
        financialYear: project.financialYear,
        totalProgressUpdates: project.progressUpdates?.length || 0,
        totalFinancialUpdates: project.financialProgressUpdates?.length || 0,
        totalActiveQueries:
          project.queries?.filter((q) => q.isActive).length || 0,
      },
    });
  } catch (error) {
    console.error("Error retrieving archive project documents:", error);

    if (error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID format",
        details: {
          providedId: req.params.projectId,
          error: error.message,
          expectedFormat: "Valid project identifier string",
        },
      });
    }

    res.status(500).json({
      success: false,
      message:
        "Internal server error occurred while retrieving archive project documents",
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
