const jwt = require('jsonwebtoken');
const config = require('../config/env');
const User = require('../models/User');

// Helper to generate signed JWT token
const signToken = (id, role, rememberMe = false) => {
  const expiresIn = rememberMe ? '30d' : (config.jwtExpiresIn || '7d');
  return jwt.sign({ id, role }, config.jwtSecret, { expiresIn });
};

/**
 * Register a new user account (Developer or Tester)
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // 1. Basic validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required.'
      });
    }

    if (name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Full name must be at least 2 characters long.'
      });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    if (!password || password.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 8 characters long.'
      });
    }

    // Role validation: strict whitelist enforcement on backend
    const normalizedRole = (role || 'tester').toLowerCase().trim();
    const ALLOWED_ROLES = ['developer', 'tester'];
    if (!ALLOWED_ROLES.includes(normalizedRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role selected. Allowed roles are: ${ALLOWED_ROLES.join(', ')}.`
      });
    }

    // 2. Check for duplicate email
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address already exists. Please sign in instead.'
      });
    }

    // 3. Create user
    const newUser = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: normalizedRole
    });

    // 4. Generate JWT
    const token = signToken(newUser._id, newUser.role, false);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: newUser
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Sign in with email and password
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password, rememberMe } = req.body;

    if (!email || !email.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email address and password.'
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Explicitly select password since it has select: false on schema
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password. Please verify your credentials and try again.'
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password. Please verify your credentials and try again.'
      });
    }

    const token = signToken(user._id, user.role, !!rememberMe);

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      token,
      user
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get current authenticated user profile
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
};

module.exports = {
  register,
  login,
  getMe
};
