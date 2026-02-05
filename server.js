const express = require("express");
const path = require("path");

const db = require("./db");
const { getOrCreateUser, completeLesson } = require("./userService");

const app = express();
app.use(express.json());

/* =========================
   STATIC (Mini App)
========================= */

app.use(express.static(path.join(__dirname, "web")));

/* =========================
   API: USERS
========================= */

// получить пользователя и прогресс
app.get("/api/user/:telegramId", (req, res) => {
  const telegramId = Number(req.params.telegramId);

  if (!telegramId) {
    return res.status(400).json({ error: "Invalid telegramId" });
  }

  const user = getOrCreateUser(telegramId);
  res.json(user);
});

// прохождение урока
app.post("/api/lesson", (req, res) => {
  const { telegramId, lessonNumber } = req.body;

  if (!telegramId || !lessonNumber) {
    return res.status(400).json({ error: "Missing data" });
  }

  const result = completeLesson(Number(telegramId), Number(lessonNumber));
  res.json(result);
});

/* =========================
   API: TEACHERS
========================= */

app.get("/api/teachers", (req, res) => {
  const teachers = db.prepare(
    "SELECT id, name, description FROM teachers ORDER BY id"
  ).all();

  res.json(teachers);
});

/* =========================
   API: COURSES
========================= */

app.get("/api/courses/:teacherId", (req, res) => {
  const teacherId = Number(req.params.teacherId);

  if (!teacherId) {
    return res.status(400).json({ error: "Invalid teacherId" });
  }

  const courses = db
    .prepare(
      "SELECT id, teacher_id, title, description FROM courses WHERE teacher_id = ? ORDER BY id"
    )
    .all(teacherId);

  res.json(courses);
});

// уроки курса
app.get("/api/lessons/:courseId", (req, res) => {
  const courseId = Number(req.params.courseId);

  if (!courseId) {
    return res.status(400).json({ error: "Invalid courseId" });
  }

  const lessons = db
    .prepare(
      "SELECT id, lesson_number, title, description FROM lessons WHERE course_id = ? ORDER BY lesson_number"
    )
    .all(courseId);

  res.json(lessons);
});


/* =========================
   HEALTHCHECK (Render)
========================= */

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});



/* =========================
   START SERVER
========================= */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
