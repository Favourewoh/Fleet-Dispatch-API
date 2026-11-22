const jwt = require('jsonwebtoken');

const UNAUTHORIZED_ERROR = Object.freeze({
  code: 'UNAUTHORIZED',
  message: 'Invalid or missing authentication token',
});

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || typeof authHeader !== 'string') {
    return res.status(401).json({ error: UNAUTHORIZED_ERROR });
  }

  const parts = authHeader.trim().split(/\s+/);
  if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
    return res.status(401).json({ error: UNAUTHORIZED_ERROR });
  }

  const token = parts[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.id,
      role: payload.role,
    };
    return next();
  } catch (_err) {
    return res.status(401).json({ error: UNAUTHORIZED_ERROR });
  }
}

module.exports = { authenticateToken };