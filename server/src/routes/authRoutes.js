const express = require('express');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Public auth routes
router.post('/register', register);
router.post('/login', login);

// Protected user route
router.get('/me', protect, getMe);

module.exports = router;
