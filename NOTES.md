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

## Git workflow for the fleet API

### Why a branch and pull request for every step
main must always work, because Render will deploy from it. Every step happens on its own branch (feat/auth-login, docs/git-workflow and so on), and it reaches main only through a pull request. If a step goes wrong, main was never touched. If it goes wrong after merging, git revert adds a new commit that undoes it, so I never use reset or force-push on main.

### Why squash and merge
Squashing turns a branch's small commits into one clean commit on main, so history reads as one commit per step, and undoing a step is one revert. The small commits stay visible inside the pull request.

### What a pull request contains
The code, any migration, and the NOTES entry for that step, plus a short description: what, why, how I tested, and database changes. I read the Files changed tab before merging to catch stray secrets and debug lines.

### What rollback does not cover
Reverting code does not undo a migration that already ran. A wrong migration is fixed with a new migration.

## Fleet and Dispatch API: Step 4, login

### Why route, controller and service are separate files
The route says where a request goes and which checks run first. The controller reads the request and sends the response. The service holds the rules and the database query. A blocked or invalid request never reaches the service, and the rules can be tested without Express.

### Why the same 401 for an unknown email and a wrong password
If the messages differed, an attacker could use the login route to find out which emails have accounts. Both cases return the same status and the same wording. Input that is missing or not a string is rejected earlier with a 400, before any database work.

### Why the email is lowercased before the lookup
My unique index is on LOWER(email), so I lowercase the email in the query too. Both sides then compare the same way.

### What the token holds
The JWT payload holds only id and role, signed with JWT_SECRET and expiring after JWT_EXPIRES_IN. Nothing sensitive goes inside it, because anyone can read a JWT's payload. The role is read from the verified token, never from the request body.

### Why the server refuses to start without a strong JWT_SECRET
If the secret were missing or short, tokens could be forged or guessed. The boot check stops the server with an error instead of letting it run unsafely.

### Why the login limiter counts failed attempts only
The limit is per IP and uses skipSuccessfulRequests, so real users who log in correctly are not blocked, while someone guessing passwords hits 429. I tested it and got [status/when].

## Fleet and Dispatch API: Step 5, authentication and authorization middleware

### Authentication vs authorization
authenticateToken answers "who are you?" It reads the Authorization header, expects Bearer followed by the token, verifies it with JWT_SECRET, and puts id and role on req.user. authorizeRoles answers "are you allowed here?" It checks req.user.role against the allowed list. A failure of the first returns 401 and a failure of the second returns 403, so a caller can tell "log in" from "you may not do this".

### Why every token failure returns the same 401
A missing header, a malformed one, a bad signature and an expired token all return the same 401 and message. The caller learns nothing about which part failed, and I don't leak how my tokens work.

### Why /auth/me selects only the columns it returns
The query selects id, name, email and role by the id from the verified token, so password_hash is never loaded into the response code at all. A column that is never selected cannot be leaked by a mistake.

### Why JWT_EXPIRES_IN is 15 minutes
A short expiry shrinks the window an attacker has with a stolen token. The cost is that users must log in again every 15 minutes, because this project has no refresh tokens. That is fine for dispatchers using Postman. I will revisit it when couriers start using the API, either with a longer expiry or by adding refresh tokens on purpose.

### Why authenticateToken does not check the database on every request
A JWT is valid until it expires, so a user who is deactivated or whose role changes keeps their old access until their current token runs out. I accept this because it saves a database query on every request, and the 15-minute expiry limits the window. If I needed instant revocation, I would check is_active in the database, at least on sensitive routes such as admin registration.

### Why POST /auth/register is admin-only
There is no public sign-up. Staff accounts are created by an admin, so the route sits behind authenticateToken and then authorizeRoles('admin'). The first admin comes from the seed script, and every other account comes through this route.

### Why a role in the request body is safe here
Taking the role from the body would be dangerous on a public route, because anyone could ask to be admin. Here the route is protected first, so only an admin ever reaches the code that reads it. The value is also checked against the three allowed roles (admin, dispatcher, courier), and the database CHECK constraint is a second line of defence.

### Why I catch the unique violation instead of checking the email first
If I looked up the email and then inserted, two simultaneous requests could both pass the check, and one would fail later with a confusing error. Instead I insert and catch Postgres error code 23505, which means a unique violation, and return 409 for that code only. Every other error returns a fixed 500 message. This is the same idea as the atomic UPDATE in my first project: let the database be the one place that decides.

### Why the response never contains password_hash
The insert returns only id, name, email and role. The hash is stored but never sent back.

### Why shipments.status has a CHECK as well as code validation
My code validates the status first, so the caller gets a clear 400. The database CHECK is the last line of defence for anything that does not go through that code: a typo in one query, a seed script, an import, or a hand-typed UPDATE in psql. The real cost of having the rule in two places is maintenance, not speed. Adding a status means changing the code list and writing a migration for the constraint, and if I forget one, they drift apart. I keep the statuses in one constant in my code and note above the CHECK that the two must match. A CHECK only controls which values are allowed. It cannot control which transitions are allowed, because that needs the previous status, so transition rules live in my code, inside the transaction.

## Fleet and Dispatch API: Step 6, shipments and shipment_events migration

### Why shipments.status has a CHECK as well as code validation
My code validates the status first, so the caller gets a clear 400. The database CHECK is the last line of defence for anything that does not go through that code: a typo in one query, a seed script, an import, or a hand-typed UPDATE in psql. The real cost of having the rule in two places is maintenance, not speed. Adding a status means changing the code list and writing a migration for the constraint, and if I forget one, they drift apart. I keep the statuses in one constant in my code and note above the CHECK that the two must match. A CHECK only controls which values are allowed. It cannot control which transitions are allowed, because that needs the previous status, so transition rules live in my code, inside the transaction.

### Why from_status can be NULL
The very first event of a shipment (its creation) has no previous status, so from_status allows NULL and its CHECK explicitly accepts NULL. to_status is NOT NULL, because every event moves to some status.

### Why ON DELETE RESTRICT on the event history
shipment_events.shipment_id first used CASCADE, which would silently delete a shipment's whole history when the shipment was deleted. An audit trail exists to survive. My design cancels shipments and never deletes them, so RESTRICT makes the database refuse the one action the design never allows. created_by and changed_by also use RESTRICT, so a user who touched a shipment cannot be deleted.

### Why receiver_phone is text
Nigerian numbers start with 0, and a number type would drop it. A phone number is an identifier, not something I do arithmetic on, so it is stored as VARCHAR.

### Why weight_kg is NUMERIC with a CHECK above zero
NUMERIC stores exact decimals, so 2.5 kg stays 2.5. A float could store a rounding error. The CHECK (weight_kg > 0) rejects zero and negative weights at the database level.

### Why tracking_number is just UNIQUE in the database
The database only guarantees no duplicates. The value itself is generated in my code as a random, non-sequential string, so strangers cannot walk through other shipments' public status by counting.

### Why indexes on status and shipment_id
I will filter shipments by status and fetch a shipment's events by shipment_id. Indexes make those lookups fast. An index also makes writes slightly slower, so I only add the ones I know I need.

### Why updated_at needs help from my code
DEFAULT now() applies only when a row is inserted. Nothing updates the column on later changes, so my status UPDATE queries must set updated_at = NOW() themselves.

### How I checked the result
I ran the migration, ran down and up again to prove the down step works, then used \d on both tables to confirm the real columns, checks and foreign keys match what I intended.

### Why creating a shipment and logging its first event is one transaction
Creating a shipment inserts a row into shipments and a first row into shipment_events. If the second insert fails, the first must be undone, or I would have a shipment with no history. A transaction makes the pair all or nothing: BEGIN, both inserts, COMMIT, and ROLLBACK if anything throws. A single SQL statement is atomic on its own, which is why one UPDATE ... RETURNING was enough in my first project, but two statements need an explicit transaction.

### How transactions work with the pg Pool
pool.query() can use a different connection for each call, so a BEGIN and the inserts after it could land on different connections and there would be no transaction. I borrow one client with pool.connect(), run everything on that client, and release it in a finally block. Forgetting to release leaks connections until the pool is exhausted and the app hangs.
