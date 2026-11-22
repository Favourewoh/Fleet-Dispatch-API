const crypto = require('crypto');
const bcrypt = require('bcrypt');
const ALLOWED_ROLES = Object.freeze(['admin', 'dispatcher', 'courier']);

// creating re-usable helpers
function createHttpError(status, message, code = "BAD_REQUEST") {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

const validateAndSanitizeBody = (body) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw createHttpError(400, "Invalid request body.", "INVALID_BODY");
  }

  const { name, email, password, role } = body;

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    typeof role !== "string"
  ) {
    throw createHttpError(
      400,
      "All registration fields must be text strings.",
      "INVALID_FIELD_TYPE"
    );
  }

  const cleanedName = name.trim();
  if (!cleanedName) {
    throw createHttpError(400, "Name is required.", "NAME_REQUIRED");
  }

  const cleanedEmail = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!cleanedEmail || !emailRegex.test(cleanedEmail)) {
    throw createHttpError(400, "Enter a valid email address.", "INVALID_EMAIL");
  }

  const normalizedRole = role.trim();
  if (!ALLOWED_ROLES.includes(normalizedRole)) {
    throw createHttpError(400, "Invalid user role.", "INVALID_ROLE");
  }

  if (!password) {
    throw createHttpError(400, "Password is required.", "PASSWORD_REQUIRED");
  }

  if (password.length < 8) {
    throw createHttpError(
      400,
      "Password must be at least 8 characters long.",
      "PASSWORD_TOO_SHORT"
    );
  }

  if (Buffer.byteLength(password, "utf8") > 72) {
    throw createHttpError(
      400,
      "Password cannot exceed 72 characters.",
      "PASSWORD_TOO_LONG"
    );
  }

  return {
    name: cleanedName,
    email: cleanedEmail,
    password,
    role: normalizedRole,
  };
};

const hashPassword = async (password) => {
  const saltRounds = 10;
  return bcrypt.hash(password, saltRounds);
};

const generateVerificationToken = () => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
return { rawToken, tokenHash};
};


module.exports = {
  validateAndSanitizeBody,
  hashPassword,
  generateVerificationToken
};