// src/utils/pdfHelpers.js

/**
 * PDF Generation Helper Utilities
 * Collection of utility functions to support PDF generation
 */

// ==========================================
// DATE AND TIME UTILITIES
// ==========================================

/**
 * Format date for PDF display
 * @param {string|Date} dateString - Date to format
 * @param {string} locale - Locale for formatting (default: 'en-IN')
 * @returns {string} Formatted date string
 */
export const formatPDFDate = (dateString, locale = "en-IN") => {
  if (!dateString) return "Not specified";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";

    return date.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (error) {
    console.warn("Error formatting date:", error);
    return "Invalid date";
  }
};

/**
 * Format date and time for PDF display
 * @param {string|Date} dateString - Date to format
 * @param {string} locale - Locale for formatting (default: 'en-IN')
 * @returns {string} Formatted date and time string
 */
export const formatPDFDateTime = (dateString, locale = "en-IN") => {
  if (!dateString) return "Not specified";

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "Invalid date";

    return date.toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (error) {
    console.warn("Error formatting datetime:", error);
    return "Invalid date";
  }
};

/**
 * Calculate duration between two dates in a human-readable format
 * @param {string|Date} startDate - Start date
 * @param {string|Date} endDate - End date (default: current date)
 * @returns {string} Duration string
 */
export const calculateDuration = (startDate, endDate = new Date()) => {
  if (!startDate) return "Unknown duration";

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return "Invalid dates";
    }

    const diffInMs = Math.abs(end - start);
    const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return "Today";
    if (diffInDays === 1) return "1 day";
    if (diffInDays < 30) return `${diffInDays} days`;
    if (diffInDays < 365) {
      const months = Math.floor(diffInDays / 30);
      const remainingDays = diffInDays % 30;
      return remainingDays > 0
        ? `${months} months, ${remainingDays} days`
        : `${months} months`;
    }

    const years = Math.floor(diffInDays / 365);
    const remainingDays = diffInDays % 365;
    const months = Math.floor(remainingDays / 30);

    let result = `${years} year${years > 1 ? "s" : ""}`;
    if (months > 0) result += `, ${months} month${months > 1 ? "s" : ""}`;

    return result;
  } catch (error) {
    console.warn("Error calculating duration:", error);
    return "Unknown duration";
  }
};

// ==========================================
// CURRENCY AND NUMBER FORMATTING
// ==========================================

/**
 * Format currency for PDF display (Indian format)
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: 'INR')
 * @param {string} locale - Locale for formatting (default: 'en-IN')
 * @returns {string} Formatted currency string
 */
export const formatPDFCurrency = (
  amount,
  currency = "INR",
  locale = "en-IN"
) => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `0.00 ${currency}`;
  }

  try {
    const formatter = new Intl.NumberFormat(locale, {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    return `${formatter.format(amount)} ${currency}`;
  } catch (error) {
    console.warn("Error formatting currency:", error);
    return `${amount} ${currency}`;
  }
};

/**
 * Format currency in lakhs/crores for large amounts
 * @param {number} amount - Amount to format
 * @param {string} currency - Currency code (default: 'INR')
 * @returns {string} Formatted currency string with lakhs/crores
 */
export const formatLargeAmountINR = (amount, currency = "INR") => {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return `0.00 ${currency}`;
  }

  try {
    if (amount >= 10000000) {
      // 1 crore
      const crores = (amount / 10000000).toFixed(2);
      return `₹${crores} Crore`;
    } else if (amount >= 100000) {
      // 1 lakh
      const lakhs = (amount / 100000).toFixed(2);
      return `₹${lakhs} Lakh`;
    } else {
      return formatPDFCurrency(amount, currency);
    }
  } catch (error) {
    console.warn("Error formatting large amount:", error);
    return formatPDFCurrency(amount, currency);
  }
};

/**
 * Format percentage with proper symbol
 * @param {number} percentage - Percentage to format
 * @param {number} decimals - Number of decimal places (default: 1)
 * @returns {string} Formatted percentage string
 */
export const formatPercentage = (percentage, decimals = 1) => {
  if (percentage === null || percentage === undefined || isNaN(percentage)) {
    return "0%";
  }

  return `${parseFloat(percentage).toFixed(decimals)}%`;
};

// ==========================================
// TEXT PROCESSING UTILITIES
// ==========================================

/**
 * Truncate text to fit PDF constraints
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length (default: 100)
 * @param {string} suffix - Suffix for truncated text (default: '...')
 * @returns {string} Truncated text
 */
export const truncateText = (text, maxLength = 100, suffix = "...") => {
  if (!text || typeof text !== "string") return "";

  if (text.length <= maxLength) return text;

  return text.substring(0, maxLength - suffix.length) + suffix;
};

/**
 * Clean and sanitize text for PDF display
 * @param {string} text - Text to sanitize
 * @returns {string} Sanitized text
 */
export const sanitizeTextForPDF = (text) => {
  if (!text || typeof text !== "string") return "";

  return text
    .replace(/[\r\n]+/g, " ") // Replace line breaks with spaces
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .trim();
};

/**
 * Convert text to title case
 * @param {string} text - Text to convert
 * @returns {string} Title case text
 */
export const toTitleCase = (text) => {
  if (!text || typeof text !== "string") return "";

  return text
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

// ==========================================
// STATUS AND PROGRESS UTILITIES
// ==========================================

/**
 * Get progress status with color code for PDF styling
 * @param {number} progress - Progress percentage
 * @returns {object} Status object with text and color
 */
export const getProgressStatusWithColor = (progress) => {
  if (!progress || progress === 0) {
    return { status: "Not Started", color: [128, 128, 128] }; // Gray
  }
  if (progress < 25) {
    return { status: "Just Started", color: [255, 69, 0] }; // Red Orange
  }
  if (progress < 50) {
    return { status: "In Progress", color: [255, 165, 0] }; // Orange
  }
  if (progress < 75) {
    return { status: "Halfway Complete", color: [255, 215, 0] }; // Gold
  }
  if (progress < 100) {
    return { status: "Near Completion", color: [173, 255, 47] }; // Green Yellow
  }
  return { status: "Completed", color: [34, 139, 34] }; // Forest Green
};

/**
 * Calculate project health score based on multiple factors
 * @param {object} projectData - Project data object
 * @returns {object} Health score object
 */
export const calculateProjectHealthScore = (projectData) => {
  let score = 0;
  const factors = [];

  // Physical progress factor (40% weight)
  const physicalProgress = projectData.progress || 0;
  const physicalScore = Math.min(physicalProgress * 0.4, 40);
  score += physicalScore;
  factors.push({
    name: "Physical Progress",
    score: physicalScore,
    weight: "40%",
  });

  // Financial progress factor (40% weight)
  const financialProgress = projectData.financialProgress || 0;
  const financialScore = Math.min(financialProgress * 0.4, 40);
  score += financialScore;
  factors.push({
    name: "Financial Progress",
    score: financialScore,
    weight: "40%",
  });

  // Timeline adherence factor (10% weight)
  let timelineScore = 10; // Start with full score
  if (projectData.FWODate) {
    const daysSinceFWO = Math.ceil(
      (new Date() - new Date(projectData.FWODate)) / (1000 * 60 * 60 * 24)
    );
    if (daysSinceFWO > 365 && physicalProgress < 100) {
      timelineScore = Math.max(0, 10 - ((daysSinceFWO - 365) / 365) * 10);
    }
  }
  score += timelineScore;
  factors.push({
    name: "Timeline Adherence",
    score: timelineScore,
    weight: "10%",
  });

  // Update frequency factor (10% weight)
  const totalUpdates =
    (projectData.totalProgressUpdates || 0) +
    (projectData.totalFinancialProgressUpdates || 0);
  const updateScore = Math.min(totalUpdates * 2, 10); // 2 points per update, max 10
  score += updateScore;
  factors.push({ name: "Update Frequency", score: updateScore, weight: "10%" });

  // Determine health status
  let status = "Critical";
  let color = [255, 0, 0]; // Red

  if (score >= 80) {
    status = "Excellent";
    color = [34, 139, 34]; // Forest Green
  } else if (score >= 60) {
    status = "Good";
    color = [255, 215, 0]; // Gold
  } else if (score >= 40) {
    status = "Fair";
    color = [255, 165, 0]; // Orange
  } else if (score >= 20) {
    status = "Poor";
    color = [255, 69, 0]; // Red Orange
  }

  return {
    score: Math.round(score),
    status,
    color,
    factors,
    recommendation: getHealthRecommendation(score, projectData),
  };
};

/**
 * Get health recommendation based on project score and data
 * @param {number} score - Health score
 * @param {object} projectData - Project data
 * @returns {string} Recommendation text
 */
const getHealthRecommendation = (score, projectData) => {
  if (score >= 80) {
    return "Project is performing excellently. Maintain current momentum.";
  } else if (score >= 60) {
    return "Project is on track. Monitor progress regularly to maintain performance.";
  } else if (score >= 40) {
    const physicalProgress = projectData.progress || 0;
    const financialProgress = projectData.financialProgress || 0;

    if (Math.abs(physicalProgress - financialProgress) > 20) {
      return "Significant gap between physical and financial progress. Coordinate both aspects.";
    }
    return "Project needs attention. Consider accelerating progress and increasing update frequency.";
  } else {
    return "Project requires immediate intervention. Review timeline, resources, and execution strategy.";
  }
};

// ==========================================
// PDF LAYOUT UTILITIES
// ==========================================

/**
 * Calculate optimal font size based on text length and available space
 * @param {string} text - Text to display
 * @param {number} maxWidth - Maximum width available
 * @param {number} maxFontSize - Maximum font size (default: 12)
 * @param {number} minFontSize - Minimum font size (default: 8)
 * @returns {number} Optimal font size
 */
export const calculateOptimalFontSize = (
  text,
  maxWidth,
  maxFontSize = 12,
  minFontSize = 8
) => {
  if (!text) return maxFontSize;

  // Rough estimation: 1 character ≈ 0.6 * fontSize in width
  const estimatedWidth = text.length * 0.6;

  for (let fontSize = maxFontSize; fontSize >= minFontSize; fontSize--) {
    if (estimatedWidth * fontSize <= maxWidth) {
      return fontSize;
    }
  }

  return minFontSize;
};

/**
 * Split long text into multiple lines for PDF display
 * @param {string} text - Text to split
 * @param {number} maxCharsPerLine - Maximum characters per line (default: 80)
 * @returns {string[]} Array of text lines
 */
export const splitTextIntoLines = (text, maxCharsPerLine = 80) => {
  if (!text || typeof text !== "string") return [""];

  const words = text.split(" ");
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        // Word itself is too long, break it
        lines.push(word.substring(0, maxCharsPerLine));
        currentLine = word.substring(maxCharsPerLine);
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [""];
};

// ==========================================
// VALIDATION UTILITIES
// ==========================================

/**
 * Validate project data completeness for PDF generation
 * @param {object} projectData - Project data object
 * @returns {object} Validation result
 */
export const validateProjectDataForPDF = (projectData) => {
  const requiredFields = [
    "projectId",
    "nameOfWork",
    "nameOfContractor",
    "financialYear",
    "workValue",
    "concernedEngineer",
  ];

  const missingFields = [];
  const warnings = [];

  // Check required fields
  for (const field of requiredFields) {
    if (!projectData[field]) {
      missingFields.push(field);
    }
  }

  // Check for potential issues
  if (
    projectData.workValue &&
    projectData.billSubmittedAmount > projectData.workValue
  ) {
    warnings.push("Bill submitted amount exceeds work value");
  }

  if (projectData.progress > 100 || projectData.financialProgress > 100) {
    warnings.push("Progress percentage exceeds 100%");
  }

  if (
    !projectData.progressUpdates ||
    projectData.progressUpdates.length === 0
  ) {
    warnings.push("No progress updates available");
  }

  if (
    !projectData.financialProgressUpdates ||
    projectData.financialProgressUpdates.length === 0
  ) {
    warnings.push("No financial progress updates available");
  }

  return {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
    completeness: Math.round(
      ((requiredFields.length - missingFields.length) / requiredFields.length) *
        100
    ),
  };
};

// ==========================================
// EXPORT ALL UTILITIES
// ==========================================

export default {
  // Date and time
  formatPDFDate,
  formatPDFDateTime,
  calculateDuration,

  // Currency and numbers
  formatPDFCurrency,
  formatLargeAmountINR,
  formatPercentage,

  // Text processing
  truncateText,
  sanitizeTextForPDF,
  toTitleCase,

  // Status and progress
  getProgressStatusWithColor,
  calculateProjectHealthScore,

  // PDF layout
  calculateOptimalFontSize,
  splitTextIntoLines,

  // Validation
  validateProjectDataForPDF,
};
