const TargetApp = require('../models/TargetApp');
const User = require('../models/User');

// Helper to check for private or loopback IP/hostnames
const isPrivateHost = (hostname) => {
  const normalized = hostname.toLowerCase();
  if (
    normalized === 'localhost' ||
    normalized === '127.0.0.1' ||
    normalized === '::1' ||
    normalized === '0.0.0.0' ||
    normalized === '169.254.169.254' ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal')
  ) {
    return true;
  }
  // Check private IPv4 ranges (10.x.x.x, 192.168.x.x, 172.16-31.x.x)
  if (/^10\./.test(normalized) || /^192\.168\./.test(normalized) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(normalized)) {
    return true;
  }
  return false;
};

/**
 * Register a new Target Application
 * POST /api/targets
 * Role: Developer only
 */
const createTarget = async (req, res, next) => {
  try {
    const {
      name,
      targetUrl,
      environment,
      allowSubdomains,
      maxDepth,
      maxPages,
      declarationConfirmed
    } = req.body;

    // 1. Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Application name is required.'
      });
    }

    if (!targetUrl || !targetUrl.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Target application URL is required.'
      });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(targetUrl.trim());
    } catch {
      return res.status(400).json({
        success: false,
        message: 'Target URL is malformed. Please include http:// or https:// (e.g. https://example.com).'
      });
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).json({
        success: false,
        message: 'Only HTTP and HTTPS target URLs are supported.'
      });
    }

    const allowLocal = process.env.ALLOW_LOCAL_FIXTURES === 'true';
    if (isPrivateHost(parsedUrl.hostname) && !(allowLocal && (parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1'))) {
      return res.status(400).json({
        success: false,
        message: 'Target URL cannot target local loopback, link-local, or private internal network addresses.'
      });
    }

    // 2. Authorization Declaration requirement
    if (declarationConfirmed !== true) {
      return res.status(400).json({
        success: false,
        message: 'You must confirm that you own or are legally authorized to perform diagnostics on this target application.'
      });
    }

    // 3. Security: owner is ALWAYS strictly taken from req.user._id (ignoring any client-supplied ownerId)
    const newTarget = await TargetApp.create({
      name: name.trim(),
      targetUrl: parsedUrl.origin,
      environment: environment || 'staging',
      owner: req.user._id,
      authorizedScope: {
        allowedHost: parsedUrl.hostname,
        allowSubdomains: !!allowSubdomains,
        maxDepth: maxDepth ? Math.min(Math.max(parseInt(maxDepth, 10), 1), 10) : 3,
        maxPages: maxPages ? Math.min(Math.max(parseInt(maxPages, 10), 1), 100) : 25
      },
      ownershipVerification: {
        status: 'verified',
        verificationMethod: 'developer_declaration',
        declarationConfirmed: true,
        verifiedAt: new Date()
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Target application registered successfully.',
      target: newTarget
    });
  } catch (error) {
    next(error);
  }
};

/**
 * List Target Applications accessible to the current user
 * GET /api/targets
 * Developer: lists owned targets
 * Tester: lists assigned targets
 */
const getTargets = async (req, res, next) => {
  try {
    let query = { status: { $ne: 'archived' } };

    if (req.user.role === 'developer') {
      query.owner = req.user._id;
    } else if (req.user.role === 'tester') {
      query.assignedTesters = req.user._id;
    }

    const targets = await TargetApp.find(query)
      .populate('owner', 'name email role')
      .populate('assignedTesters', 'name email role')
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: targets.length,
      targets
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single Target Application by ID
 * GET /api/targets/:id
 */
const getTargetById = async (req, res, next) => {
  try {
    const target = await TargetApp.findOne({
      _id: req.params.id,
      status: { $ne: 'archived' }
    })
      .populate('owner', 'name email role')
      .populate('assignedTesters', 'name email role');

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target application not found.'
      });
    }

    // Role boundary: user must be the owner OR in assignedTesters
    const isOwner = target.owner._id.toString() === req.user._id.toString();
    const isAssignedTester = target.assignedTesters.some(
      (tester) => tester._id.toString() === req.user._id.toString()
    );

    if (!isOwner && !isAssignedTester) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: You are not authorized to view this target application.'
      });
    }

    return res.status(200).json({
      success: true,
      target
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update Target Application details
 * PUT /api/targets/:id
 * Role: Developer (owner only)
 */
const updateTarget = async (req, res, next) => {
  try {
    const target = await TargetApp.findOne({
      _id: req.params.id,
      status: { $ne: 'archived' }
    });

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target application not found.'
      });
    }

    // Only owner can update
    if (target.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only edit applications you own.'
      });
    }

    const { name, environment, allowSubdomains, maxDepth, maxPages, status } = req.body;

    if (name) target.name = name.trim();
    if (environment) target.environment = environment;
    if (allowSubdomains !== undefined) target.authorizedScope.allowSubdomains = !!allowSubdomains;
    if (maxDepth) target.authorizedScope.maxDepth = Math.min(Math.max(parseInt(maxDepth, 10), 1), 10);
    if (maxPages) target.authorizedScope.maxPages = Math.min(Math.max(parseInt(maxPages, 10), 1), 100);
    if (status && ['active', 'paused'].includes(status)) target.status = status;

    await target.save();

    const updated = await TargetApp.findById(target._id)
      .populate('owner', 'name email role')
      .populate('assignedTesters', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'Target application updated successfully.',
      target: updated
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete / Archive a Target Application
 * DELETE /api/targets/:id
 * Role: Developer (owner only)
 */
const deleteTarget = async (req, res, next) => {
  try {
    const target = await TargetApp.findById(req.params.id);

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target application not found.'
      });
    }

    if (target.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: You can only delete applications you own.'
      });
    }

    target.status = 'archived';
    await target.save();

    return res.status(200).json({
      success: true,
      message: 'Target application archived successfully.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Assign a tester to a target application
 * POST /api/targets/:id/assign-tester
 * Role: Developer (owner only)
 */
const assignTester = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Tester email address is required.'
      });
    }

    const target = await TargetApp.findOne({
      _id: req.params.id,
      status: { $ne: 'archived' }
    });

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target application not found.'
      });
    }

    if (target.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the application owner can assign testers.'
      });
    }

    // Find tester user
    const testerUser = await User.findOne({
      email: email.toLowerCase().trim(),
      role: 'tester'
    });

    if (!testerUser) {
      return res.status(404).json({
        success: false,
        message: `No tester account found for '${email}'. Please ensure the tester has registered with role: Tester.`
      });
    }

    // Check if already assigned
    const alreadyAssigned = target.assignedTesters.some(
      (id) => id.toString() === testerUser._id.toString()
    );

    if (alreadyAssigned) {
      return res.status(400).json({
        success: false,
        message: `Tester '${testerUser.name}' (${testerUser.email}) is already assigned to this application.`
      });
    }

    target.assignedTesters.push(testerUser._id);
    await target.save();

    const updatedTarget = await TargetApp.findById(target._id)
      .populate('owner', 'name email role')
      .populate('assignedTesters', 'name email role');

    return res.status(200).json({
      success: true,
      message: `Assigned tester '${testerUser.name}' successfully.`,
      target: updatedTarget
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove an assigned tester from a target application
 * DELETE /api/targets/:id/testers/:testerId
 * Role: Developer (owner only)
 */
const removeTester = async (req, res, next) => {
  try {
    const { id, testerId } = req.params;

    const target = await TargetApp.findOne({
      _id: id,
      status: { $ne: 'archived' }
    });

    if (!target) {
      return res.status(404).json({
        success: false,
        message: 'Target application not found.'
      });
    }

    if (target.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Forbidden: Only the application owner can manage tester assignments.'
      });
    }

    target.assignedTesters = target.assignedTesters.filter(
      (tid) => tid.toString() !== testerId
    );

    await target.save();

    const updated = await TargetApp.findById(target._id)
      .populate('owner', 'name email role')
      .populate('assignedTesters', 'name email role');

    return res.status(200).json({
      success: true,
      message: 'Tester unassigned successfully.',
      target: updated
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTarget,
  getTargets,
  getTargetById,
  updateTarget,
  deleteTarget,
  assignTester,
  removeTester
};
