const bcrypt = require('bcrypt');
const pool = require('../db/index.js');

const INVALID_CREDENTIALS_ERROR = Object.freeze({
  status: 401,
  code: 'INVALID_CREDENTIALS',
  message: 'Invalid email or password',
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

  return {
    ok: true,
    user: {
      id: user.id,
      role: user.role,
      is_active: user.is_active,
    },
  };
}

module.exports = { authenticateUser };