require("dotenv").config();

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : false,
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function withTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function initDb() {
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      telegram_id BIGINT PRIMARY KEY,
      lessons_completed INTEGER NOT NULL DEFAULT 0,
      xp INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'student',
      is_onboarded BOOLEAN NOT NULL DEFAULT false,
      first_name TEXT,
      last_name TEXT,
      username TEXT,
      avatar_url TEXT
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      avatar_url TEXT,
      user_id BIGINT UNIQUE REFERENCES users(telegram_id) ON DELETE SET NULL,
      UNIQUE (name)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS courses (
      id BIGSERIAL PRIMARY KEY,
      teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      price NUMERIC(10,2) NOT NULL DEFAULT 0,
      is_published BOOLEAN NOT NULL DEFAULT true,
      UNIQUE (teacher_id, title)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS lessons (
      id BIGSERIAL PRIMARY KEY,
      course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      lesson_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      is_free BOOLEAN NOT NULL DEFAULT true,
      duration_sec INTEGER,
      preview_url TEXT,
      UNIQUE (course_id, lesson_number)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS dance_styles (
      id BIGSERIAL PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL UNIQUE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS course_styles (
      course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      style_id BIGINT NOT NULL REFERENCES dance_styles(id) ON DELETE CASCADE,
      PRIMARY KEY (course_id, style_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS course_purchases (
      telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
      course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      amount NUMERIC(10,2) NOT NULL,
      status TEXT NOT NULL DEFAULT 'paid',
      purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (telegram_id, course_id)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS user_lesson_progress (
      telegram_id BIGINT NOT NULL REFERENCES users(telegram_id) ON DELETE CASCADE,
      lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (telegram_id, lesson_id)
    )
  `);

  // Backward-compatible migration for existing environments.
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student'");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_onboarded BOOLEAN NOT NULL DEFAULT false");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name TEXT");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT");
  await query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT");

  await query("ALTER TABLE teachers ADD COLUMN IF NOT EXISTS user_id BIGINT UNIQUE");
  await query("ALTER TABLE teachers ADD COLUMN IF NOT EXISTS avatar_url TEXT");
  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE table_name = 'teachers'
          AND constraint_name = 'teachers_user_id_fkey'
      ) THEN
        ALTER TABLE teachers
          ADD CONSTRAINT teachers_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES users(telegram_id) ON DELETE SET NULL;
      END IF;
    END
    $$;
  `);

  await query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0");
  await query("ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true");
  await query("UPDATE courses SET price = 199 WHERE price < 199");

  await query("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT true");
  await query("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS duration_sec INTEGER");
  await query("ALTER TABLE lessons ADD COLUMN IF NOT EXISTS preview_url TEXT");
  await query(`
    WITH ranked_free AS (
      SELECT
        id,
        ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY lesson_number, id) AS free_rank
      FROM lessons
      WHERE is_free = true
    )
    UPDATE lessons l
    SET is_free = false
    FROM ranked_free r
    WHERE l.id = r.id AND r.free_rank > 3
  `);

  await query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_role_check'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_role_check
          CHECK (role IN ('student', 'teacher', 'admin'));
      END IF;
    END
    $$;
  `);
}

module.exports = {
  initDb,
  pool,
  query,
  withTransaction,
};
