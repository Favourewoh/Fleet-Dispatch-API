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

  return res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Login service not implemented yet',
    },
  });
}

module.exports = { login };