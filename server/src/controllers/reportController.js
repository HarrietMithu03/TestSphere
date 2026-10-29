const DiagnosticReport = require('../models/DiagnosticReport');
const ScanJob = require('../models/ScanJob');
const TargetApp = require('../models/TargetApp');
const { generateReport, generatePdfReport } = require('../services/reportService');

/**
 * Generate or retrieve an existing Diagnostic Report for a scan
 * POST /api/reports
 */
const createOrGetReport = async (req, res, next) => {
  try {
    const { scanId } = req.body;
    if (!scanId) {
      return res.status(400).json({
        success: false,
        message: 'Scan ID (scanId) is required to generate a report.'
      });
    }

    const scan = await ScanJob.findById(scanId).populate('targetId');
    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan job not found.'
      });
    }

    const target = scan.targetId;
    if (target) {
      const isOwner = target.owner?.toString() === req.user._id.toString();
      const isAssignedTester = target.assignedTesters?.some(
        (tid) => tid.toString() === req.user._id.toString()
      );

      if (!isOwner && !isAssignedTester) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to generate reports for this target.'
        });
      }
    }

    if (scan.status !== 'COMPLETED' && scan.status !== 'PARTIALLY_COMPLETED') {
      return res.status(400).json({
        success: false,
        message: `Cannot generate report for scan in status '${scan.status}'. Scan must be completed.`
      });
    }

    const report = await generateReport(scanId, req.user._id);

    return res.status(201).json({
      success: true,
      message: 'Diagnostic report compiled successfully.',
      report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List diagnostic reports accessible to the user
 * GET /api/reports
 */
const getReports = async (req, res, next) => {
  try {
    // 1. Identify accessible targets
    let targetQuery = { status: { $ne: 'archived' } };
    if (req.user.role === 'developer') {
      targetQuery.owner = req.user._id;
    } else if (req.user.role === 'tester') {
      targetQuery.assignedTesters = req.user._id;
    }

    const accessibleTargets = await TargetApp.find(targetQuery).select('_id');
    const accessibleTargetIds = accessibleTargets.map((t) => t._id);

    const reports = await DiagnosticReport.find({ targetId: { $in: accessibleTargetIds } })
      .populate('targetId', 'name targetUrl environment')
      .populate('generatedBy', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: reports.length,
      reports
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single report details
 * GET /api/reports/:id
 */
const getReportById = async (req, res, next) => {
  try {
    const report = await DiagnosticReport.findById(req.params.id)
      .populate('confirmedIssues')
      .populate('suspectedIssues')
      .populate('targetId')
      .populate('generatedBy', 'name email role');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic report not found.'
      });
    }

    const target = report.targetId;
    if (target) {
      const isOwner = target.owner?.toString() === req.user._id.toString();
      const isAssignedTester = target.assignedTesters?.some(
        (tid) => tid.toString() === req.user._id.toString()
      );

      if (!isOwner && !isAssignedTester) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to view this diagnostic report.'
        });
      }
    }

    return res.status(200).json({
      success: true,
      report
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Download printable PDF export for a diagnostic report
 * GET /api/reports/:id/pdf
 */
const downloadReportPdf = async (req, res, next) => {
  try {
    const report = await DiagnosticReport.findById(req.params.id).populate('targetId');
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Diagnostic report not found.'
      });
    }

    const target = report.targetId;
    if (target) {
      const isOwner = target.owner?.toString() === req.user._id.toString();
      const isAssignedTester = target.assignedTesters?.some(
        (tid) => tid.toString() === req.user._id.toString()
      );

      if (!isOwner && !isAssignedTester) {
        return res.status(403).json({
          success: false,
          message: 'Access denied: You are not authorized to download this report.'
        });
      }
    }

    const pdfResult = await generatePdfReport(report._id, req.user._id);
    const pdfBuffer = Buffer.isBuffer(pdfResult) ? pdfResult : pdfResult.buffer;
    const filename = pdfResult?.filename || `TestSphere-Report-${report.reportNumber}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);

    return res.end(pdfBuffer);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrGetReport,
  getReports,
  getReportById,
  downloadReportPdf
};
