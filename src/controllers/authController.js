const { authenticateUser } = require('../services/authService');

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

module.exports = { login };