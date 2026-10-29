const Finding = require('../models/Finding');
const TargetApp = require('../models/TargetApp');
const ScanJob = require('../models/ScanJob');
const { generateFingerprint } = require('../scanner/fingerprinter');
const { getIO } = require('../socket');

/**
 * Validates whether the authenticated user has developer ownership or tester assignment on the target.
 */
const verifyTargetAccess = async (targetId, user) => {
  const target = await TargetApp.findOne({ _id: targetId, status: { $ne: 'archived' } });
  if (!target) return { allowed: false, error: 'Target application not found.' };

  const isOwner = target.owner.toString() === user._id.toString();
  const isAssignedTester = target.assignedTesters?.some(
    (tid) => tid.toString() === user._id.toString()
  );

  if (!isOwner && !isAssignedTester) {
    return {
      allowed: false,
      error: 'Access denied: You are not authorized to review or modify findings for this application.'
    };
  }

  return { allowed: true, target, isOwner, isAssignedTester };
};

/**
 * Validate a finding (Confirm, Flag False Positive, Mark Fixed, Retest)
 * PATCH /api/findings/:id/validate
 */
const validateFinding = async (req, res, next) => {
  try {
    const { status, notes, reason, reproductionConfirmed } = req.body;

    const validStatuses = ['unreviewed', 'confirmed', 'false_positive', 'fixed', 'retested_pass', 'retested_fail'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid validation status '${status}'. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    if (status === 'false_positive' && (!reason || !reason.trim()) && (!notes || !notes.trim())) {
      return res.status(400).json({
        success: false,
        message: 'A technical rationale or note is required when classifying an issue as a false positive.'
      });
    }

    const finding = await Finding.findById(req.params.id);
    if (!finding) {
      return res.status(404).json({
        success: false,
        message: 'Finding not found.'
      });
    }

    const authCheck = await verifyTargetAccess(finding.targetId, req.user);
    if (!authCheck.allowed) {
      return res.status(403).json({ success: false, message: authCheck.error });
    }

    // Determine action for audit history
    let action = 'validated';
    if (status === 'false_positive') action = 'false_positive_flagged';
    else if (status === 'fixed') action = 'fixed';
    else if (status.startsWith('retested')) action = 'retested';

    // Update human validation state
    finding.humanValidation = {
      status,
      validatedBy: req.user._id,
      validatedAt: new Date(),
      notes: notes ? notes.trim() : finding.humanValidation?.notes,
      reason: reason ? reason.trim() : finding.humanValidation?.reason,
      reproductionConfirmed:
        reproductionConfirmed !== undefined
          ? !!reproductionConfirmed
          : finding.humanValidation?.reproductionConfirmed
    };

    // Append to audit history
    finding.activityHistory.push({
      action,
      user: req.user._id,
      timestamp: new Date(),
      note: notes || reason || `Status updated to ${status}`
    });

    await finding.save();

    const updated = await Finding.findById(finding._id)
      .populate('humanValidation.validatedBy', 'name email role')
      .populate('activityHistory.user', 'name email role');

    // Emit live Socket.IO update if room is active
    try {
      const io = getIO();
      io.to(`scan:${finding.scanId}`).emit('finding:validated', {
        findingId: finding._id,
        humanValidation: updated.humanValidation,
        activityHistory: updated.activityHistory
      });
    } catch {}

    return res.status(200).json({
      success: true,
      message: `Finding marked as ${status}.`,
      finding: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Log a human exploratory finding
 * POST /api/findings/exploratory
 */
const createExploratoryFinding = async (req, res, next) => {
  try {
    const {
      scanId,
      targetId,
      title,
      description,
      category,
      severity,
      affectedUrl,
      affectedComponent,
      reproductionSteps,
      evidence,
      remediation,
      notes
    } = req.body;

    if (!scanId || !targetId || !title || !description || !affectedUrl) {
      return res.status(400).json({
        success: false,
        message: 'scanId, targetId, title, description, and affectedUrl are required.'
      });
    }

    const authCheck = await verifyTargetAccess(targetId, req.user);
    if (!authCheck.allowed) {
      return res.status(403).json({ success: false, message: authCheck.error });
    }

    const scan = await ScanJob.findById(scanId);
    if (!scan) {
      return res.status(404).json({ success: false, message: 'Referenced scan not found.' });
    }

    const fingerprint = generateFingerprint({
      category: category || 'runtime_error',
      title: title.trim(),
      affectedUrl: affectedUrl.trim(),
      keySignature: `exploratory::${Date.now()}::${req.user._id}`
    });

    const newFinding = await Finding.create({
      scanId,
      targetId,
      category: category || 'runtime_error',
      title: title.trim(),
      description: description.trim(),
      severity: severity || 'Medium',
      confidence: 'Confirmed',
      source: 'human_tester',
      exploratory: true,
      affectedUrl: affectedUrl.trim(),
      affectedComponent: affectedComponent ? affectedComponent.trim() : 'Manual Exploration',
      reproductionSteps: Array.isArray(reproductionSteps) ? reproductionSteps : [reproductionSteps].filter(Boolean),
      evidence: evidence || { loggedBy: req.user.name, email: req.user.email },
      remediation: remediation ? remediation.trim() : null,
      fingerprint,
      occurrenceCount: 1,
      occurrences: [
        {
          url: affectedUrl.trim(),
          timestamp: new Date()
        }
      ],
      humanValidation: {
        status: 'confirmed',
        validatedBy: req.user._id,
        validatedAt: new Date(),
        notes: notes ? notes.trim() : 'Logged during exploratory validation session.',
        reproductionConfirmed: true
      },
      activityHistory: [
        {
          action: 'created',
          user: req.user._id,
          timestamp: new Date(),
          note: 'Exploratory finding logged by human tester.'
        }
      ]
    });

    const populated = await Finding.findById(newFinding._id)
      .populate('humanValidation.validatedBy', 'name email role')
      .populate('activityHistory.user', 'name email role');

    return res.status(201).json({
      success: true,
      message: 'Exploratory finding logged successfully.',
      finding: populated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Text similarity helper (word token overlap / Jaccard index)
 */
const computeTextSimilarity = (strA, strB) => {
  if (!strA || !strB) return 0;
  const wordsA = new Set(strA.toLowerCase().match(/\w+/g) || []);
  const wordsB = new Set(strB.toLowerCase().match(/\w+/g) || []);
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return Math.round((intersection.size / union.size) * 100);
};

/**
 * Find potential duplicate suggestions using deterministic fingerprint & text similarity
 * GET /api/findings/:id/duplicate-suggestions
 */
const getDuplicateSuggestions = async (req, res, next) => {
  try {
    const finding = await Finding.findById(req.params.id);
    if (!finding) {
      return res.status(404).json({ success: false, message: 'Finding not found.' });
    }

    const authCheck = await verifyTargetAccess(finding.targetId, req.user);
    if (!authCheck.allowed) {
      return res.status(403).json({ success: false, message: authCheck.error });
    }

    // Find all other findings in the same target
    const candidates = await Finding.find({
      targetId: finding.targetId,
      _id: { $ne: finding._id }
    }).populate('humanValidation.validatedBy', 'name email');

    const suggestions = [];

    for (const cand of candidates) {
      // 1. Exact fingerprint match
      if (cand.fingerprint === finding.fingerprint) {
        suggestions.push({
          finding: cand,
          similarityScore: 100,
          reason: 'Exact fingerprint signature match (identical error and affected path).'
        });
        continue;
      }

      // 2. Title and URL text similarity
      const titleSim = computeTextSimilarity(finding.title, cand.title);
      const urlSim = computeTextSimilarity(finding.affectedUrl, cand.affectedUrl);
      const categoryMatch = finding.category === cand.category;

      const combinedScore = Math.round(titleSim * 0.6 + urlSim * 0.4);

      if (categoryMatch && combinedScore >= 50) {
        suggestions.push({
          finding: cand,
          similarityScore: combinedScore,
          reason: `High textual similarity (${combinedScore}%) within the same category (${finding.category}).`
        });
      }
    }

    suggestions.sort((a, b) => b.similarityScore - a.similarityScore);

    return res.status(200).json({
      success: true,
      count: suggestions.length,
      suggestions: suggestions.slice(0, 10)
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  validateFinding,
  createExploratoryFinding,
  getDuplicateSuggestions
};
