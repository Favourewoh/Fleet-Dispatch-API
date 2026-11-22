## Fleet and Dispatch API: Step 1, project skeleton and migrations

### Why .gitignore comes before anything else
I created .gitignore (with node_modules and .env) before my first commit. Git remembers every file it has ever tracked, so a secret committed once stays in history even if I delete it later. Ignoring .env from the start means the database password can never be committed by accident.

### Why one DATABASE_URL
The database settings live in one variable, DATABASE_URL, read by the pg Pool through connectionString. It is one value to set instead of five, and the same name works on my laptop and on Render, only the value changes. If the password has special characters like @, I must URL-encode them (@ becomes %40) or the string is misread.

### Why a /health route
GET /health returns 200 with a short JSON status, so I can check that the server is up before testing anything else. At startup the app also runs SELECT 1 through the pool, which proves the database connection works before any real route depends on it.

### Why migrations instead of editing one schema.sql
A migration is a numbered, recorded change to the database. schema.sql is fine for one fresh database, but on a live database CREATE TABLE fails because the table already exists, and adding DROP TABLE would delete real user data. A migration describes only what changes, such as adding a column, so the rows survive. The migration tool keeps a small table of which migrations have already run, and applies only the new ones, in order. Because of that, my laptop, Neon and my test database all end up with the same schema. Rollbacks are limited: an undo step cannot bring back data from a dropped column, so a wrong change is usually fixed by writing a new migration. I never edit a migration that has already been applied. I write a new one, because the tool would not notice the edit and my databases would quietly differ.

## Fleet and Dispatch API: Step 2, the users migration

### Why TIMESTAMPTZ and NOT NULL for created_at
TIMESTAMP stores a clock reading with no time zone, so the same value could mean different moments on my laptop, Render and Neon. TIMESTAMPTZ stores an exact moment and converts it for display. I also made created_at NOT NULL with DEFAULT NOW(), because a column with only a default can still be set to NULL by an insert that names it. Delivery attempts and events will depend on correct times, so I started the habit here.

### Why a unique index on LOWER(email)
A plain UNIQUE on email is case-sensitive, so Ada@club.com and ada@club.com would count as two different accounts. A unique index on LOWER(email) makes the database reject the second one. The index does not clean the value I store, so my code must still lowercase the email before saving it and before every login lookup.

### Why role is VARCHAR with a CHECK
The CHECK limits role to admin, dispatcher and courier, so a typo like "dispacher" is rejected by the database itself, even if my code has a bug. I used a CHECK instead of a Postgres ENUM because adding a new role later is a plain ALTER TABLE on a CHECK, while changing an ENUM is clumsier.

### Why the down step uses DROP TABLE IF EXISTS
Every migration has an up step (apply the change) and a down step (undo it). IF EXISTS stops the undo from crashing if the table is already gone. A down step on a table with real data deletes that data, so I only run it on my local database, never on Neon.

### How I checked the result
I ran the migration, connected with psql, and ran \d users. That showed the real column types, the NOT NULL settings, the unique lower-case email index and the role check, so I know the database matches what I wrote and not just what I intended.

## Fleet and Dispatch API: Step 3, the first-admin seed script

### Why a seed script creates the first admin
POST /auth/register will be admin-only, so on a fresh database nobody could ever create the first account. A one-time script solves that: it creates the first admin directly in the database, and from then on only an admin can register new users.

### Why the credentials come from environment variables
The script file goes into git, so a password written in it would be public history forever. ADMIN_EMAIL and ADMIN_PASSWORD live in .env, which is git-ignored, and .env.example holds only the names. The same script works on any environment, and the values change per place. The password is the real secret. On Neon I will run it once with a different password, set only in my terminal for that run, and never reuse the local one.

### Why the script hashes the password and lowercases the email
The password is hashed with bcrypt before it is saved, so the database never holds the real password. The email is lowercased because my unique index is on LOWER(email), and my login lookup will lowercase it too, so both sides compare the same way.

### Why the script is safe to run twice
It uses ON CONFLICT on the same lower-case email expression as the unique index, so a second run does not create a second admin or crash. A seed script that breaks when repeated is dangerous, because someone will repeat it.

## feat/auth-login (2026-11-22)

- **Endpoint & Architecture:** Implemented `POST /api/v1/auth/login` in CommonJS across `src/routes/auth.js`, `src/controllers/authController.js`, and `src/services/authService.js`, mounted under `/api/v1/auth`.
- **Startup & Config:** Added boot-time validation requiring `JWT_SECRET` to be present and at least 32 characters long before starting the server, alongside `JWT_EXPIRES_IN` in `.env` / `.env.example`.
- **Validation & Auth Flow:**
  - Enforced `400` (`VALIDATION_ERROR`) when `email` or `password` is missing or not a non-empty string.
  - Looked up users via case-insensitive `LOWER(email)` parameterized queries, verified passwords with `bcrypt.compare`, and returned identical `401` (`INVALID_CREDENTIALS`) responses for unknown emails and wrong passwords.
  - Returned `403` (`ACCOUNT_INACTIVE`) when `is_active` is `false` after valid credentials so deactivated accounts are clearly distinguished.
  - Signed JWTs containing only `id` and `role` using `JWT_SECRET` and `JWT_EXPIRES_IN` without logging passwords or tokens.
- **Rate Limiting:** Added `loginRateLimiter` (`429` `RATE_LIMIT_EXCEEDED`) on `/login` with `skipSuccessfulRequests: true` so only failed attempts count toward the limit.
- **Verification:** Verified `200` (valid credentials), `401` (wrong password and unknown email), and `403` (inactive user toggled in `psql`) in Postman.