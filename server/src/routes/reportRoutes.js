const express = require('express');
const router = express.Router();
const {
  createOrGetReport,
  getReports,
  getReportById,
  downloadReportPdf
} = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.route('/')
  .get(getReports)
  .post(createOrGetReport);

router.route('/:id')
  .get(getReportById);

router.route('/:id/pdf')
  .get(downloadReportPdf);

module.exports = router;
