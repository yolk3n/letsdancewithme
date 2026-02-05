const express = require("express");
const path = require("path");

const db = require("./db");
const { getOrCreateUser, completeLesson } = require("./userService");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "web")));

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

app.get(
  "/api/user/:telegramId",
  asyncRoute(async (req, res) => {
    const telegramId = Number(req.params.telegramId);
    if (!telegramId) {
      return res.status(400).json({ error: "Invalid telegramId" });
    }

    const user = await getOrCreateUser(telegramId);
    res.json(user);
  })
);

app.post(
  "/api/lesson",
  asyncRoute(async (req, res) => {
    const { telegramId, lessonNumber } = req.body;
    if (!telegramId || !lessonNumber) {
      return res.status(400).json({ error: "Missing data" });
    }

    const result = await completeLesson(Number(telegramId), Number(lessonNumber));
    res.json(result);
  })
);

app.get(
  "/api/teachers",
  asyncRoute(async (req, res) => {
    const result = await db.query(
      "SELECT id, name, description FROM teachers ORDER BY id"
    );
    res.json(result.rows);
  })
);

app.get(
  "/api/courses/:teacherId",
  asyncRoute(async (req, res) => {
    const teacherId = Number(req.params.teacherId);
    if (!teacherId) {
      return res.status(400).json({ error: "Invalid teacherId" });
    }

    const result = await db.query(
      "SELECT id, teacher_id, title, description FROM courses WHERE teacher_id = $1 ORDER BY id",
      [teacherId]
    );
    res.json(result.rows);
  })
);

app.get(
  "/api/lessons/:courseId",
  asyncRoute(async (req, res) => {
    const courseId = Number(req.params.courseId);
    if (!courseId) {
      return res.status(400).json({ error: "Invalid courseId" });
    }

    const result = await db.query(
      "SELECT id, lesson_number, title, description FROM lessons WHERE course_id = $1 ORDER BY lesson_number",
      [courseId]
    );
    res.json(result.rows);
  })
);

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

async function startServer() {
  await db.initDb();
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`API server running on port ${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server", error);
  process.exit(1);
});
