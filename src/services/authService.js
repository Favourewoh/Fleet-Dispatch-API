const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db/index.js');
const { validateAndSanitizeBody, hashPassword } = require('../utils/authHelpers.js');

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

const DUPLICATE_EMAIL_ERROR = Object.freeze({
  status: 409,
  code: 'EMAIL_ALREADY_EXISTS',
  message: 'An account with this email already exists',
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

async function getCurrentUser(userId) {
  const { rows } = await pool.query(
    `SELECT id, name, email, role
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  return rows[0] || null;
}

async function registerUser(data) {
  const passwordHash = await hashPassword(data.password);

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, name, email, role, is_active`,
      [data.name, data.email, passwordHash, data.role]
    );

    return {
      ok: true,
      user: rows[0],
    };
  } catch (error) {
    if (error.code === '23505') {
      return {
        ok: false,
        error: DUPLICATE_EMAIL_ERROR,
      };
    }

    throw error;
  }
}

module.exports = { authenticateUser, getCurrentUser, registerUser };

module.exports = { 
  authenticateUser,
  getCurrentUser,
  registerUser
};