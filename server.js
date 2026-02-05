const express = require("express");
const path = require("path");

const db = require("./db");
const { getOrCreateUser, setOnboardingComplete, completeLesson } = require("./userService");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "web")));

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function parseTelegramId(req) {
  const raw =
    req.headers["x-telegram-id"] ??
    req.headers["x-telegram-user-id"] ??
    req.query.telegramId ??
    req.body?.telegramId;

  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function requireUser() {
  return asyncRoute(async (req, res, next) => {
    const telegramId = parseTelegramId(req);
    if (!telegramId) {
      return res.status(401).json({ error: "Missing telegram user id" });
    }

    req.currentUser = await getOrCreateUser(telegramId);
    return next();
  });
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.currentUser || !allowedRoles.includes(req.currentUser.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    return next();
  };
}

async function getOrCreateTeacherProfile(telegramId) {
  const existing = await db.query(
    "SELECT id, user_id, name, description, avatar_url FROM teachers WHERE user_id = $1",
    [telegramId]
  );
  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const created = await db.query(
    `
      INSERT INTO teachers (user_id, name, description, avatar_url)
      VALUES ($1, $2, $3, $4)
      RETURNING id, user_id, name, description, avatar_url
    `,
    [telegramId, `Teacher ${telegramId}`, "New teacher profile", null]
  );

  return created.rows[0];
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

app.get(
  "/api/me",
  requireUser(),
  asyncRoute(async (req, res) => {
    res.json(req.currentUser);
  })
);

app.post(
  "/api/onboarding/complete",
  requireUser(),
  asyncRoute(async (req, res) => {
    const updatedUser = await setOnboardingComplete(req.currentUser.telegram_id);
    res.json(updatedUser);
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
      "SELECT id, name, description, avatar_url FROM teachers ORDER BY id"
    );
    res.json(result.rows);
  })
);

app.get(
  "/api/styles",
  asyncRoute(async (req, res) => {
    const result = await db.query(
      "SELECT id, slug, name FROM dance_styles ORDER BY name"
    );
    res.json(result.rows);
  })
);

app.get(
  "/api/courses/:teacherId",
  asyncRoute(async (req, res) => {
    const teacherId = Number(req.params.teacherId);
    const styleId = req.query.styleId ? Number(req.query.styleId) : null;

    if (!teacherId) {
      return res.status(400).json({ error: "Invalid teacherId" });
    }

    let sql = `
      SELECT c.id, c.teacher_id, c.title, c.description, c.price, c.is_published
      FROM courses c
      WHERE c.teacher_id = $1
    `;
    const params = [teacherId];

    if (styleId) {
      sql += `
        AND EXISTS (
          SELECT 1
          FROM course_styles cs
          WHERE cs.course_id = c.id AND cs.style_id = $2
        )
      `;
      params.push(styleId);
    }

    sql += " ORDER BY c.id";

    const result = await db.query(sql, params);
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
      `
        SELECT
          id,
          lesson_number,
          title,
          description,
          is_free,
          duration_sec,
          preview_url
        FROM lessons
        WHERE course_id = $1
        ORDER BY lesson_number
      `,
      [courseId]
    );
    res.json(result.rows);
  })
);

app.get(
  "/api/teacher/profile",
  requireUser(),
  requireRole("teacher", "admin"),
  asyncRoute(async (req, res) => {
    const teacher = await getOrCreateTeacherProfile(req.currentUser.telegram_id);
    res.json(teacher);
  })
);

app.put(
  "/api/teacher/profile",
  requireUser(),
  requireRole("teacher", "admin"),
  asyncRoute(async (req, res) => {
    const teacher = await getOrCreateTeacherProfile(req.currentUser.telegram_id);
    const { name, description, avatarUrl } = req.body;

    const result = await db.query(
      `
        UPDATE teachers
        SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          avatar_url = COALESCE($3, avatar_url)
        WHERE id = $4
        RETURNING id, user_id, name, description, avatar_url
      `,
      [
        typeof name === "string" ? name.trim() : null,
        typeof description === "string" ? description : null,
        typeof avatarUrl === "string" ? avatarUrl : null,
        teacher.id,
      ]
    );

    res.json(result.rows[0]);
  })
);

app.get(
  "/api/teacher/courses",
  requireUser(),
  requireRole("teacher", "admin"),
  asyncRoute(async (req, res) => {
    const teacher = await getOrCreateTeacherProfile(req.currentUser.telegram_id);
    const result = await db.query(
      `
        SELECT id, teacher_id, title, description, price, is_published
        FROM courses
        WHERE teacher_id = $1
        ORDER BY id
      `,
      [teacher.id]
    );
    res.json(result.rows);
  })
);

app.post(
  "/api/teacher/courses",
  requireUser(),
  requireRole("teacher", "admin"),
  asyncRoute(async (req, res) => {
    const teacher = await getOrCreateTeacherProfile(req.currentUser.telegram_id);
    const { title, description = "", price = 0, isPublished = true, styleIds = [] } = req.body;

    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "title is required" });
    }

    const created = await db.query(
      `
        INSERT INTO courses (teacher_id, title, description, price, is_published)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, teacher_id, title, description, price, is_published
      `,
      [teacher.id, title.trim(), description, Number(price) || 0, Boolean(isPublished)]
    );

    if (Array.isArray(styleIds) && styleIds.length > 0) {
      const values = styleIds
        .map((styleId) => Number(styleId))
        .filter((styleId) => Number.isInteger(styleId) && styleId > 0);
      for (const styleId of values) {
        await db.query(
          `
            INSERT INTO course_styles (course_id, style_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `,
          [created.rows[0].id, styleId]
        );
      }
    }

    res.status(201).json(created.rows[0]);
  })
);

app.put(
  "/api/teacher/courses/:courseId",
  requireUser(),
  requireRole("teacher", "admin"),
  asyncRoute(async (req, res) => {
    const courseId = Number(req.params.courseId);
    if (!courseId) {
      return res.status(400).json({ error: "Invalid courseId" });
    }

    const teacher = await getOrCreateTeacherProfile(req.currentUser.telegram_id);
    const owns = await db.query(
      "SELECT id FROM courses WHERE id = $1 AND teacher_id = $2",
      [courseId, teacher.id]
    );

    if (!owns.rows[0]) {
      return res.status(404).json({ error: "Course not found" });
    }

    const {
      title,
      description,
      price,
      isPublished,
      styleIds,
    } = req.body;

    const updated = await db.query(
      `
        UPDATE courses
        SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          price = COALESCE($3, price),
          is_published = COALESCE($4, is_published)
        WHERE id = $5
        RETURNING id, teacher_id, title, description, price, is_published
      `,
      [
        typeof title === "string" ? title.trim() : null,
        typeof description === "string" ? description : null,
        price === undefined ? null : Number(price),
        isPublished === undefined ? null : Boolean(isPublished),
        courseId,
      ]
    );

    if (Array.isArray(styleIds)) {
      await db.query("DELETE FROM course_styles WHERE course_id = $1", [courseId]);
      const values = styleIds
        .map((styleId) => Number(styleId))
        .filter((styleId) => Number.isInteger(styleId) && styleId > 0);
      for (const styleId of values) {
        await db.query(
          `
            INSERT INTO course_styles (course_id, style_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `,
          [courseId, styleId]
        );
      }
    }

    res.json(updated.rows[0]);
  })
);

app.post(
  "/api/teacher/courses/:courseId/lessons",
  requireUser(),
  requireRole("teacher", "admin"),
  asyncRoute(async (req, res) => {
    const courseId = Number(req.params.courseId);
    if (!courseId) {
      return res.status(400).json({ error: "Invalid courseId" });
    }

    const teacher = await getOrCreateTeacherProfile(req.currentUser.telegram_id);
    const owns = await db.query(
      "SELECT id FROM courses WHERE id = $1 AND teacher_id = $2",
      [courseId, teacher.id]
    );
    if (!owns.rows[0]) {
      return res.status(404).json({ error: "Course not found" });
    }

    const {
      lessonNumber,
      title,
      description = "",
      isFree = true,
      durationSec = null,
      previewUrl = null,
    } = req.body;

    if (!lessonNumber || !title) {
      return res.status(400).json({ error: "lessonNumber and title are required" });
    }

    const created = await db.query(
      `
        INSERT INTO lessons (
          course_id,
          lesson_number,
          title,
          description,
          is_free,
          duration_sec,
          preview_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (course_id, lesson_number) DO UPDATE
        SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          is_free = EXCLUDED.is_free,
          duration_sec = EXCLUDED.duration_sec,
          preview_url = EXCLUDED.preview_url
        RETURNING id, course_id, lesson_number, title, description, is_free, duration_sec, preview_url
      `,
      [
        courseId,
        Number(lessonNumber),
        title,
        description,
        Boolean(isFree),
        durationSec === null ? null : Number(durationSec),
        previewUrl,
      ]
    );

    res.status(201).json(created.rows[0]);
  })
);

app.put(
  "/api/teacher/lessons/:lessonId",
  requireUser(),
  requireRole("teacher", "admin"),
  asyncRoute(async (req, res) => {
    const lessonId = Number(req.params.lessonId);
    if (!lessonId) {
      return res.status(400).json({ error: "Invalid lessonId" });
    }

    const teacher = await getOrCreateTeacherProfile(req.currentUser.telegram_id);
    const owns = await db.query(
      `
        SELECT l.id
        FROM lessons l
        JOIN courses c ON c.id = l.course_id
        WHERE l.id = $1 AND c.teacher_id = $2
      `,
      [lessonId, teacher.id]
    );
    if (!owns.rows[0]) {
      return res.status(404).json({ error: "Lesson not found" });
    }

    const {
      title,
      description,
      isFree,
      durationSec,
      previewUrl,
      lessonNumber,
    } = req.body;

    const updated = await db.query(
      `
        UPDATE lessons
        SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          is_free = COALESCE($3, is_free),
          duration_sec = COALESCE($4, duration_sec),
          preview_url = COALESCE($5, preview_url),
          lesson_number = COALESCE($6, lesson_number)
        WHERE id = $7
        RETURNING id, course_id, lesson_number, title, description, is_free, duration_sec, preview_url
      `,
      [
        title === undefined ? null : title,
        description === undefined ? null : description,
        isFree === undefined ? null : Boolean(isFree),
        durationSec === undefined ? null : Number(durationSec),
        previewUrl === undefined ? null : previewUrl,
        lessonNumber === undefined ? null : Number(lessonNumber),
        lessonId,
      ]
    );

    res.json(updated.rows[0]);
  })
);

app.get(
  "/api/admin/users",
  requireUser(),
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `
        SELECT telegram_id, role, is_onboarded, lessons_completed, xp
        FROM users
        ORDER BY telegram_id
      `
    );
    res.json(result.rows);
  })
);

app.put(
  "/api/admin/users/:telegramId/role",
  requireUser(),
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const targetTelegramId = Number(req.params.telegramId);
    const { role } = req.body;

    if (!targetTelegramId || !["student", "teacher", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid target user or role" });
    }

    const targetUser = await getOrCreateUser(targetTelegramId);
    if (!targetUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const updated = await db.query(
      `
        UPDATE users
        SET role = $1
        WHERE telegram_id = $2
        RETURNING telegram_id, role, is_onboarded, lessons_completed, xp
      `,
      [role, targetTelegramId]
    );

    res.json(updated.rows[0]);
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
