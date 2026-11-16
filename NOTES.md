## Fleet and Dispatch API: Step 1, project skeleton and migrations

### Why .gitignore comes before anything else
I created .gitignore (with node_modules and .env) before my first commit. Git remembers every file it has ever tracked, so a secret committed once stays in history even if I delete it later. Ignoring .env from the start means the database password can never be committed by accident.

### Why one DATABASE_URL
The database settings live in one variable, DATABASE_URL, read by the pg Pool through connectionString. It is one value to set instead of five, and the same name works on my laptop and on Render, only the value changes. If the password has special characters like @, I must URL-encode them (@ becomes %40) or the string is misread.

### Why a /health route
GET /health returns 200 with a short JSON status, so I can check that the server is up before testing anything else. At startup the app also runs SELECT 1 through the pool, which proves the database connection works before any real route depends on it.

### Why migrations instead of editing one schema.sql
A migration is a numbered, recorded change to the database. schema.sql is fine for one fresh database, but on a live database CREATE TABLE fails because the table already exists, and adding DROP TABLE would delete real user data. A migration describes only what changes, such as adding a column, so the rows survive. The migration tool keeps a small table of which migrations have already run, and applies only the new ones, in order. Because of that, my laptop, Neon and my test database all end up with the same schema. Rollbacks are limited: an undo step cannot bring back data from a dropped column, so a wrong change is usually fixed by writing a new migration. I never edit a migration that has already been applied. I write a new one, because the tool would not notice the edit and my databases would quietly differ.