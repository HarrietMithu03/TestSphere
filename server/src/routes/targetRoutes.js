const express = require('express');
const {
  createTarget,
  getTargets,
  getTargetById,
  updateTarget,
  deleteTarget,
  assignTester,
  removeTester
} = require('../controllers/targetController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// All target routes require authentication
router.use(protect);

// List & Create targets
router.route('/')
  .get(getTargets)
  .post(authorize('developer'), createTarget);

// Single target operations
router.route('/:id')
  .get(getTargetById)
  .put(authorize('developer'), updateTarget)
  .delete(authorize('developer'), deleteTarget);

// Tester assignment operations (Developer only)
router.post('/:id/assign-tester', authorize('developer'), assignTester);
router.delete('/:id/testers/:testerId', authorize('developer'), removeTester);

module.exports = router;
