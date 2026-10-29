const express = require('express');
const router = express.Router();
const {
  validateFinding,
  createExploratoryFinding,
  getDuplicateSuggestions
} = require('../controllers/findingController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/exploratory', createExploratoryFinding);
router.patch('/:id/validate', validateFinding);
router.get('/:id/duplicate-suggestions', getDuplicateSuggestions);

module.exports = router;
