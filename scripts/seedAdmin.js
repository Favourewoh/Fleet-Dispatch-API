require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../src/db/index.js');

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL;
  const plainPassword = process.env.ADMIN_PASSWORD;

  if (!email || !plainPassword) {
    console.error('Error: ADMIN_EMAIL and ADMIN_PASSWORD must be defined in environment variables.');
    process.exit(1);
  }

  try {
    // 1. Check if an admin user already exists
    const existingAdmin = await pool.query(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
    );

    if (existingAdmin.rows.length > 0) {
      console.log('Admin user already exists. Skipping seed operation.');
      process.exit(0);
    }

    // 2. Hash the password securely with bcrypt (salt rounds = 10)
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(plainPassword, saltRounds);

    // 3. Insert the first admin into the database
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5)`,
      ['System Admin', email, passwordHash, 'admin', true]
    );

    console.log('First admin user seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin user:', error.message);
    process.exit(1);
  }
}

seedAdmin();