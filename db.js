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
      xp INTEGER NOT NULL DEFAULT 0
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      UNIQUE (name)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS courses (
      id BIGSERIAL PRIMARY KEY,
      teacher_id BIGINT NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
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
      UNIQUE (course_id, lesson_number)
    )
  `);
}

module.exports = {
  initDb,
  pool,
  query,
  withTransaction,
};
