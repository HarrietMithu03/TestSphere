const ScanJob = require('../models/ScanJob');
const Finding = require('../models/Finding');
const TargetApp = require('../models/TargetApp');
const scanQueue = require('../scanner/scanQueue');

/**
 * Launch/Queue a new scan for a target application
 * POST /api/scans
 * Role: Developer (owner only)
 */
const createScan = async (req, res, next) => {
  try {
    const { targetId } = req.body;

    if (!targetId) {
      return res.status(400).json({
        success: false,
        message: 'Target application ID (targetId) is required.'
      });
    }

    const target = await TargetApp.findOne({
      _id: targetId,
      status: { $ne: 'archived' }
    });

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target application not found.'
      });
    }

    // Role & Ownership/Assignment enforcement: Developer owner or assigned QA Tester
    const isOwner = target.owner.toString() === req.user._id.toString();
    const isAssignedTester = target.assignedTesters?.some(
      (tid) => tid.toString() === req.user._id.toString()
    );

    if (!isOwner && !isAssignedTester) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only initiate scans for target applications you own or are assigned to.'
      });
    }

    // Check if an active scan is already in progress for this target
    const existingActiveScan = await ScanJob.findOne({
      targetId: target._id,
      status: { $in: ['QUEUED', 'RUNNING'] }
    });

    if (existingActiveScan) {
      return res.status(409).json({
        success: false,
        message: 'A diagnostic scan is already queued or actively running for this application.',
        activeScanId: existingActiveScan._id
      });
    }

    // Snapshot target settings at time of scan
    const targetSnapshot = {
      name: target.name,
      targetUrl: target.targetUrl,
      allowedHost: target.authorizedScope?.allowedHost,
      environment: target.environment,
      maxDepth: target.authorizedScope?.maxDepth || 3,
      maxPages: target.authorizedScope?.maxPages || 25,
      rateLimitRps: target.scanPolicy?.rateLimitRps || 2,
      maxScanDurationSeconds: target.scanPolicy?.maxScanDurationSeconds || 300
    };

    const newScan = await ScanJob.create({
      targetId: target._id,
      requestedBy: req.user._id,
      status: 'QUEUED',
      currentStage: 'QUEUED',
      progress: 0,
      targetSnapshot
    });

    // Enqueue scan in background job queue
    await scanQueue.enqueue(newScan._id.toString());

    const populatedScan = await ScanJob.findById(newScan._id)
      .populate('targetId', 'name targetUrl environment authorizedScope')
      .populate('requestedBy', 'name email role');

    return res.status(201).json({
      success: true,
      message: 'Automated diagnostic scan created and queued.',
      scan: populatedScan
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List scan history for targets accessible to the current user
 * GET /api/scans
 * Developer: scans on owned targets
 * Tester: scans on assigned targets
 */
const getScans = async (req, res, next) => {
  try {
    const { targetId, status } = req.query;

    // 1. Identify accessible targets
    let targetQuery = { status: { $ne: 'archived' } };
    if (req.user.role === 'developer') {
      targetQuery.owner = req.user._id;
    } else if (req.user.role === 'tester') {
      targetQuery.assignedTesters = req.user._id;
    }

    const accessibleTargets = await TargetApp.find(targetQuery).select('_id');
    const accessibleTargetIds = accessibleTargets.map((t) => t._id);

    // 2. Build scan query
    const scanQuery = {
      targetId: { $in: accessibleTargetIds }
    };

    if (targetId) {
      // Ensure targetId is within accessible list
      if (!accessibleTargetIds.some((id) => id.toString() === targetId)) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this target history.'
        });
      }
      scanQuery.targetId = targetId;
    }

    if (status) {
      scanQuery.status = status;
    }

    const scans = await ScanJob.find(scanQuery)
      .populate('targetId', 'name targetUrl environment authorizedScope')
      .populate('requestedBy', 'name email role')
      .sort({ createdAt: -1 })
      .limit(50);

    return res.status(200).json({
      success: true,
      count: scans.length,
      scans
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get single scan details and live progress
 * GET /api/scans/:id
 */
const getScanById = async (req, res, next) => {
  try {
    const scan = await ScanJob.findById(req.params.id)
      .populate('targetId', 'name targetUrl environment authorizedScope owner assignedTesters')
      .populate('requestedBy', 'name email role');

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
          message: 'Access denied: You are not authorized to view this scan job.'
        });
      }
    }

    return res.status(200).json({
      success: true,
      scan
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Cancel an active or queued scan safely
 * POST /api/scans/:id/cancel
 * Role: Developer (owner only)
 */
const cancelScan = async (req, res, next) => {
  try {
    const scan = await ScanJob.findById(req.params.id).populate('targetId');

    if (!scan) {
      return res.status(404).json({
        success: false,
        message: 'Scan job not found.'
      });
    }

    const target = scan.targetId;
    if (target && target.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the target owner can cancel this scan.'
      });
    }

    if (['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED'].includes(scan.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel scan that is already in '${scan.status}' state.`
      });
    }

    await scanQueue.cancel(scan._id.toString());

    const updated = await ScanJob.findById(scan._id)
      .populate('targetId', 'name targetUrl environment')
      .populate('requestedBy', 'name email');

    return res.status(200).json({
      success: true,
      message: 'Scan cancellation requested.',
      scan: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve findings associated with a scan
 * GET /api/scans/:id/findings
 */
const getScanFindings = async (req, res, next) => {
  try {
    const { category, severity, confidence } = req.query;

    const scan = await ScanJob.findById(req.params.id).populate('targetId');
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
          message: 'Access denied: You are not authorized to view findings for this scan.'
        });
      }
    }

    const query = { scanId: scan._id };
    if (category) query.category = category;
    if (severity) query.severity = severity;
    if (confidence) query.confidence = confidence;

    const findings = await Finding.find(query).sort({
      // Sort critical/high first, then newest
      severity: 1,
      createdAt: -1
    });

    return res.status(200).json({
      success: true,
      count: findings.length,
      scanId: scan._id,
      targetId: target?._id,
      findings
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Run Live Diagnostic Benchmark
 * POST /api/scans/benchmark
 * Role: Developer or Assigned Tester
 */
const runLiveBenchmark = async (req, res, next) => {
  try {
    const { targetId } = req.body || {};
    let target = null;

    if (targetId) {
      target = await TargetApp.findOne({
        _id: targetId,
        status: { $ne: 'archived' }
      });

      if (!target) {
        return res.status(404).json({
          success: false,
          message: 'Target application not found.'
        });
      }

      const isOwner = target.owner.toString() === req.user._id.toString();
      const isAssignedTester = target.assignedTesters?.some(
        (tid) => tid.toString() === req.user._id.toString()
      );

      if (!isOwner && !isAssignedTester) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You are not authorized to run benchmarks on this application.'
        });
      }
    } else {
      if (req.user.role === 'tester') {
        // Find an assigned target for this tester
        target = await TargetApp.findOne({
          assignedTesters: req.user._id,
          status: { $ne: 'archived' }
        });

        if (!target) {
          return res.status(403).json({
            success: false,
            message: 'No applications assigned. You can only run benchmarks on applications assigned to you by a Developer.'
          });
        }
      } else {
        // Developer role: find or create benchmark fixture target
        const fixtureUrl = 'http://127.0.0.1:5050';
        target = await TargetApp.findOne({
          owner: req.user._id,
          targetUrl: fixtureUrl,
          status: { $ne: 'archived' }
        });

        if (!target) {
          target = await TargetApp.create({
            name: 'Controlled Test Fixture (Live Benchmark)',
            targetUrl: fixtureUrl,
            environment: 'development',
            owner: req.user._id,
            authorizedScope: {
              allowedHost: '127.0.0.1',
              allowSubdomains: false,
              maxDepth: 2,
              maxPages: 8
            },
            ownershipVerification: {
              status: 'verified',
              verificationMethod: 'developer_declaration',
              declarationConfirmed: true,
              verifiedAt: new Date()
            }
          });
        }
      }
    }

    // Ensure fixture server is online if targeting local fixture URL
    if (target.targetUrl.includes('5050') || target.targetUrl.includes('127.0.0.1')) {
      let fixtureHealthy = false;
      try {
        const ping = await fetch('http://127.0.0.1:5050', { signal: AbortSignal.timeout(2000) });
        if (ping.ok || ping.status === 200) {
          fixtureHealthy = true;
        }
      } catch {
        fixtureHealthy = false;
      }

      if (!fixtureHealthy) {
        try {
          const { createFixtureServer } = require('../../test/fixtureServer');
          createFixtureServer(5050);
        } catch (err) {
          console.warn('[runLiveBenchmark] Could not auto-start fixture server:', err.message);
        }
      }
    }

    // 2. Check if an active scan is already running on this target
    const existingActiveScan = await ScanJob.findOne({
      targetId: target._id,
      status: { $in: ['QUEUED', 'RUNNING'] }
    });

    if (existingActiveScan) {
      if (scanQueue.isActiveOrQueued(existingActiveScan._id.toString())) {
        const populatedScan = await ScanJob.findById(existingActiveScan._id)
          .populate('targetId', 'name targetUrl environment authorizedScope')
          .populate('requestedBy', 'name email role');

        return res.status(200).json({
          success: true,
          message: 'A diagnostic benchmark scan is already in progress.',
          scan: populatedScan,
          target
        });
      } else {
        // Orphaned scan from prior process: cancel and proceed with fresh benchmark
        existingActiveScan.status = 'CANCELLED';
        existingActiveScan.currentStage = 'CANCELLED';
        existingActiveScan.errorSummary = 'Previous scan terminated unexpectedly.';
        existingActiveScan.endTime = new Date();
        await existingActiveScan.save();
      }
    }

    // 3. Create a new ScanJob
    const targetSnapshot = {
      name: target.name,
      targetUrl: target.targetUrl,
      allowedHost: target.authorizedScope?.allowedHost || '127.0.0.1',
      environment: target.environment,
      maxDepth: target.authorizedScope?.maxDepth || 2,
      maxPages: target.authorizedScope?.maxPages || 8,
      rateLimitRps: 5,
      maxScanDurationSeconds: 120
    };

    const newScan = await ScanJob.create({
      targetId: target._id,
      requestedBy: req.user._id,
      status: 'QUEUED',
      currentStage: 'QUEUED',
      progress: 0,
      targetSnapshot
    });

    // 4. Enqueue in ScanQueue
    await scanQueue.enqueue(newScan._id.toString());

    const populatedScan = await ScanJob.findById(newScan._id)
      .populate('targetId', 'name targetUrl environment authorizedScope')
      .populate('requestedBy', 'name email role');

    return res.status(201).json({
      success: true,
      message: 'Live diagnostic benchmark initiated successfully.',
      scan: populatedScan,
      target
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createScan,
  getScans,
  getScanById,
  cancelScan,
  getScanFindings,
  runLiveBenchmark
};
