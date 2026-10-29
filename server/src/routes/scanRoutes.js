const express = require('express');
const router = express.Router();
const {
  createScan,
  getScans,
  getScanById,
  cancelScan,
  getScanFindings,
  runLiveBenchmark
} = require('../controllers/scanController');
const { protect, authorize } = require('../middleware/auth');

// All scan routes require an authenticated user
router.use(protect);

// GET /api/scans - List accessible scans
// POST /api/scans - Create a scan (Developer owner or Assigned Tester)
router.route('/')
  .get(getScans)
  .post(authorize('developer', 'tester'), createScan);

// POST /api/scans/benchmark - Run Live Benchmark (Developer owner or Assigned Tester)
router.route('/benchmark')
  .post(authorize('developer', 'tester'), runLiveBenchmark);

// GET /api/scans/:id - Get scan details
router.route('/:id')
  .get(getScanById);

// POST /api/scans/:id/cancel - Cancel active scan (Developer only)
router.route('/:id/cancel')
  .post(authorize('developer'), cancelScan);

// GET /api/scans/:id/findings - Get findings for a scan
router.route('/:id/findings')
  .get(getScanFindings);

module.exports = router;
