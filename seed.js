const db = require("./db");

// Включаем поддержку foreign keys (ВАЖНО для SQLite)
db.prepare("PRAGMA foreign_keys = ON").run();

// Чистим в ПРАВИЛЬНОМ порядке
db.prepare("DELETE FROM courses").run();
db.prepare("DELETE FROM teachers").run();

// Добавляем преподавателей
const insertTeacher = db.prepare(
  "INSERT INTO teachers (name, description) VALUES (?, ?)"
);

insertTeacher.run("Алекс", "Salsa NY, On2");
insertTeacher.run("Мария", "Bachata, Lady Style");

// Добавляем курсы
const insertCourse = db.prepare(
  "INSERT INTO courses (teacher_id, title, description) VALUES (?, ?, ?)"
);

// ВАЖНО: teacher_id должен существовать
insertCourse.run(1, "Salsa NY для начинающих", "База, шаги, ритм");
insertCourse.run(2, "Bachata с нуля", "Основы бачаты");

console.log("Seed выполнен успешно ✅");
