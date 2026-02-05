const Database = require("better-sqlite3");

const db = new Database("database.db");

// Таблица пользователей
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    lessons_completed INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0
  )
`).run();

module.exports = db;
