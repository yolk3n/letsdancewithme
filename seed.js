const db = require("./db");

// очищаем (безопасно для MVP)
db.prepare("DELETE FROM teachers").run();
db.prepare("DELETE FROM courses").run();

// преподаватели
db.prepare(
  "INSERT INTO teachers (name, description) VALUES (?, ?)"
).run("Алекс", "Salsa NY, On2");

db.prepare(
  "INSERT INTO teachers (name, description) VALUES (?, ?)"
).run("Мария", "Bachata, Lady Style");

// курсы
db.prepare(
  "INSERT INTO courses (teacher_id, title, description) VALUES (?, ?, ?)"
).run(1, "Salsa NY для начинающих", "База, шаги, ритм");

db.prepare(
  "INSERT INTO courses (teacher_id, title, description) VALUES (?, ?, ?)"
).run(2, "Bachata с нуля", "Основы бачаты");

console.log("Seed готов ✅");
