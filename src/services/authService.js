const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/index.js');

const INVALID_CREDENTIALS_ERROR = Object.freeze({
  status: 401,
  code: 'INVALID_CREDENTIALS',
  message: 'Invalid email or password',
});

const INACTIVE_ACCOUNT_ERROR = Object.freeze({
  status: 403,
  code: 'ACCOUNT_INACTIVE',
  message: 'Account is inactive. Contact an administrator.',
});

async function authenticateUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();

  const { rows } = await pool.query(
    `SELECT id, email, password_hash, role, is_active
     FROM users
     WHERE LOWER(email) = $1
     LIMIT 1`,
    [normalizedEmail]
  );

  const user = rows[0];
  if (!user) {
    return { ok: false, error: INVALID_CREDENTIALS_ERROR };
  }

  const passwordMatches = await bcrypt.compare(password, user.password_hash);
  if (!passwordMatches) {
    return { ok: false, error: INVALID_CREDENTIALS_ERROR };
  }

  if (!user.is_active) {
    return { ok: false, error: INACTIVE_ACCOUNT_ERROR };
  }

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  return {
    ok: true,
    token,
  };
}

module.exports = { authenticateUser };