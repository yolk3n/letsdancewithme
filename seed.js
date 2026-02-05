const db = require("./db");

db.prepare("PRAGMA foreign_keys = ON").run();

// чистим в правильном порядке
db.prepare("DELETE FROM lessons").run();
db.prepare("DELETE FROM courses").run();
db.prepare("DELETE FROM teachers").run();

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

// уроки (курс 1)
const insertLesson = db.prepare(
  "INSERT INTO lessons (course_id, lesson_number, title, description) VALUES (?, ?, ?, ?)"
);

insertLesson.run(1, 1, "Базовый шаг", "Основной шаг salsa NY");
insertLesson.run(1, 2, "Правый поворот", "Техника поворота");
insertLesson.run(1, 3, "Связка", "Соединяем движения");
insertLesson.run(1, 4, "Комбинация", "Продвинутая связка");

// уроки (курс 2)
insertLesson.run(2, 1, "Базовый шаг", "Основной шаг бачаты");
insertLesson.run(2, 2, "Волна", "Работа корпусом");

console.log("Seed с уроками выполнен ✅");
