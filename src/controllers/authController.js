const { authenticateUser, getCurrentUser, registerUser } = require('../services/authService');
const { validateAndSanitizeBody } = require('../utils/authHelpers');

async function login(req, res) {
  const { email, password } = req.body || {};

  if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Email and password must be non-empty strings',
      },
    });
  }

  try {
    const result = await authenticateUser({ email, password });

    if (!result.ok) {
      return res.status(result.error.status).json({
        error: {
          code: result.error.code,
          message: result.error.message,
        },
      });
    }

    return res.status(200).json({
      token: result.token,
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong while logging in',
      },
    });
  }
}

async function me(req, res) {
  try {
    const user = await getCurrentUser(req.user.id);

    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid or missing authentication token',
        },
      });
    }

    return res.status(200).json({ user });
  } catch (error) {
    console.error('Get current user error:', error.message);
    return res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Something went wrong while fetching profile',
      },
    });
  }
};

async function register(req, res) {
  let sanitizedData;

  try {
    sanitizedData = validateAndSanitizeBody(req.body);
  } catch (err) {
    return res.status(err.status || 400).json({
      error: {
        code: err.code || "VALIDATION_ERROR",
        message: err.message,
      },
    });
  }

  try {
    const result = await registerUser(sanitizedData);

    if (!result.ok) {
      return res.status(result.error?.status || 400).json({
        error: {
          code: result.error?.code || "REGISTRATION_FAILED",
          message: result.error?.message || "Unable to register user.",
        },
      });
    }

    return res.status(201).json({
      user: result.user,
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Something went wrong while processing your request.",
      },
    });
  }
}

module.exports = {
  login,
  me,
  register
};