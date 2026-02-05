const express = require("express");
const { getOrCreateUser } = require("./userService");

const app = express();
app.use(express.json());

app.get("/api/user/:telegramId", (req, res) => {
  const telegramId = Number(req.params.telegramId);
  const user = getOrCreateUser(telegramId);

  res.json(user);
});

const path = require("path");

app.use(express.static(path.join(__dirname, "web")));

const db = require("./db");

// список преподавателей
app.get("/api/teachers", (req, res) => {
  const teachers = db.prepare("SELECT * FROM teachers").all();
  res.json(teachers);
});

// курсы преподавателя
app.get("/api/courses/:teacherId", (req, res) => {
  const teacherId = Number(req.params.teacherId);
  const courses = db
    .prepare("SELECT * FROM courses WHERE teacher_id = ?")
    .all(teacherId);

  res.json(courses);
});


app.listen(3000, () => {
  console.log("API сервер запущен на http://localhost:3000");
});

const { completeLesson } = require("./userService");

app.post("/api/lesson", (req, res) => {
  const { telegramId, lessonNumber } = req.body;

  if (!telegramId || !lessonNumber) {
    return res.status(400).json({ error: "Missing data" });
  }

  const result = completeLesson(Number(telegramId), Number(lessonNumber));
  res.json(result);
});