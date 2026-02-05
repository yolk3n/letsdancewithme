const Database = require("better-sqlite3");

const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "database.db");
const db = new Database(dbPath);

// Таблица пользователей
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    lessons_completed INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0
  )
`).run();

// Таблица преподавателей
db.prepare(`
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT
  )
`).run();

// Таблица курсов
db.prepare(`
  CREATE TABLE IF NOT EXISTS courses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    teacher_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (teacher_id) REFERENCES teachers(id)
  )
`).run();

module.exports = db;
