const express = require("express");
const path = require("path");

const db = require("./db");
const { getOrCreateUser, syncTelegramProfile, setOnboardingComplete, completeLesson } = require("./userService");
const COURSE_MIN_PRICE = 199;
const MAX_FREE_LESSONS_PER_COURSE = 3;
const COURSE_LEVELS = new Set(["beginner", "advanced", "professional"]);

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

function isFiniteNumber(value) {
  return Number.isFinite(Number(value));
}

function asOptionalTrimmedString(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function asCourseLevel(value, fallback = "beginner") {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  return COURSE_LEVELS.has(normalized) ? normalized : fallback;
}

async function getOrCreateTeacherProfile(telegramId) {
  const existing = await db.query(
    "SELECT id, user_id, name, description, about_short, avatar_url FROM teachers WHERE user_id = $1",
    [telegramId]
  );
  if (existing.rows[0]) {
    return existing.rows[0];
  }

  const created = await db.query(
    `
      INSERT INTO teachers (user_id, name, description, about_short, avatar_url)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, name, description, about_short, avatar_url
    `,
    [telegramId, `Teacher ${telegramId}`, "New teacher profile", null, null]
  );

  return created.rows[0];
}

async function countFreeLessonsInCourse(courseId, excludeLessonId = null) {
  if (excludeLessonId) {
    const result = await db.query(
      "SELECT COUNT(*)::int AS count FROM lessons WHERE course_id = $1 AND is_free = true AND id <> $2",
      [courseId, excludeLessonId]
    );
    return result.rows[0].count;
  }

  const result = await db.query(
    "SELECT COUNT(*)::int AS count FROM lessons WHERE course_id = $1 AND is_free = true",
    [courseId]
  );
  return result.rows[0].count;
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
  "/api/profile/sync",
  requireUser(),
  asyncRoute(async (req, res) => {
    const profile = req.body || {};
    const user = await syncTelegramProfile(req.currentUser.telegram_id, {
      first_name: profile.first_name,
      last_name: profile.last_name,
      username: profile.username,
      avatar_url: profile.avatar_url,
    });
    res.json(user);
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
    const { telegramId, courseId, lessonNumber } = req.body;
    if (!telegramId || !courseId || !lessonNumber) {
      return res.status(400).json({ error: "Missing data" });
    }

    const result = await completeLesson(
      Number(telegramId),
      Number(courseId),
      Number(lessonNumber)
    );
    if (result.reason === "lesson_not_found") {
      return res.status(404).json({ error: "Lesson not found" });
    }
    res.json(result);
  })
);

app.get(
  "/api/teachers",
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `
        WITH published_courses AS (
          SELECT id, teacher_id
          FROM courses
          WHERE is_published = true
        ),
        teacher_styles AS (
          SELECT
            x.teacher_id,
            json_agg(
              json_build_object('id', x.style_id, 'name', x.style_name)
              ORDER BY x.style_name
            ) AS styles
          FROM (
            SELECT DISTINCT
              pc.teacher_id,
              ds.id AS style_id,
              ds.name AS style_name
            FROM published_courses pc
            JOIN course_styles cs ON cs.course_id = pc.id
            JOIN dance_styles ds ON ds.id = cs.style_id
          ) x
          GROUP BY x.teacher_id
        ),
        teacher_students AS (
          SELECT
            pc.teacher_id,
            COUNT(DISTINCT cp.telegram_id)::int AS students_count
          FROM published_courses pc
          JOIN course_purchases cp ON cp.course_id = pc.id AND cp.status = 'paid'
          GROUP BY pc.teacher_id
        ),
        student_last_purchase AS (
          SELECT
            pc.teacher_id,
            u.telegram_id,
            u.avatar_url,
            MAX(cp.purchased_at) AS last_purchase_at
          FROM published_courses pc
          JOIN course_purchases cp ON cp.course_id = pc.id AND cp.status = 'paid'
          JOIN users u ON u.telegram_id = cp.telegram_id
          WHERE u.avatar_url IS NOT NULL
          GROUP BY pc.teacher_id, u.telegram_id, u.avatar_url
        ),
        student_preview AS (
          SELECT teacher_id, json_agg(avatar_url ORDER BY last_purchase_at DESC) AS student_avatars_preview
          FROM (
            SELECT
              teacher_id,
              avatar_url,
              last_purchase_at,
              ROW_NUMBER() OVER (PARTITION BY teacher_id ORDER BY last_purchase_at DESC) AS rn
            FROM student_last_purchase
          ) ranked
          WHERE ranked.rn <= 5
          GROUP BY teacher_id
        ),
        published_count AS (
          SELECT teacher_id, COUNT(*)::int AS published_courses_count
          FROM published_courses
          GROUP BY teacher_id
        )
        SELECT
          t.id,
          t.name,
          t.description,
          t.about_short,
          t.avatar_url,
          COALESCE(pc.published_courses_count, 0) AS published_courses_count,
          COALESCE(ts.styles, '[]'::json) AS styles,
          COALESCE(st.students_count, 0) AS students_count,
          COALESCE(sp.student_avatars_preview, '[]'::json) AS student_avatars_preview
        FROM teachers t
        LEFT JOIN published_count pc ON pc.teacher_id = t.id
        LEFT JOIN teacher_styles ts ON ts.teacher_id = t.id
        LEFT JOIN teacher_students st ON st.teacher_id = t.id
        LEFT JOIN student_preview sp ON sp.teacher_id = t.id
        ORDER BY COALESCE(pc.published_courses_count, 0) DESC, t.name ASC
      `
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
  "/api/student/courses",
  requireUser(),
  asyncRoute(async (req, res) => {
    const teacherId = req.query.teacherId ? Number(req.query.teacherId) : null;
    const styleId = req.query.styleId ? Number(req.query.styleId) : null;
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    const purchasedOnly = req.query.purchased === "1";

    if (teacherId !== null && !Number.isInteger(teacherId)) {
      return res.status(400).json({ error: "Invalid teacherId" });
    }
    if (styleId !== null && !Number.isInteger(styleId)) {
      return res.status(400).json({ error: "Invalid styleId" });
    }

    const params = [req.currentUser.telegram_id];
    let sql = `
      WITH lesson_totals AS (
        SELECT l.course_id, COUNT(*)::int AS total_lessons
        FROM lessons l
        GROUP BY l.course_id
      ),
      lesson_progress AS (
        SELECT l.course_id, COUNT(*)::int AS completed_lessons
        FROM user_lesson_progress ulp
        JOIN lessons l ON l.id = ulp.lesson_id
        WHERE ulp.telegram_id = $1
        GROUP BY l.course_id
      ),
      style_agg AS (
        SELECT
          cs.course_id,
          json_agg(json_build_object('id', ds.id, 'name', ds.name) ORDER BY ds.name) AS styles
        FROM course_styles cs
        JOIN dance_styles ds ON ds.id = cs.style_id
        GROUP BY cs.course_id
      )
      SELECT
        c.id,
        c.title,
        c.description,
        c.price,
        c.level,
        c.is_published,
        t.id AS teacher_id,
        t.name AS teacher_name,
        t.about_short AS teacher_about_short,
        t.avatar_url AS teacher_avatar_url,
        CASE WHEN cp.telegram_id IS NULL THEN false ELSE true END AS is_purchased,
        COALESCE(lt.total_lessons, 0) AS total_lessons,
        COALESCE(lp.completed_lessons, 0) AS completed_lessons,
        CASE
          WHEN COALESCE(lt.total_lessons, 0) = 0 THEN 0
          ELSE ROUND((COALESCE(lp.completed_lessons, 0)::numeric / lt.total_lessons::numeric) * 100)::int
        END AS progress_percent,
        COALESCE(sa.styles, '[]'::json) AS styles
      FROM courses c
      JOIN teachers t ON t.id = c.teacher_id
      LEFT JOIN lesson_totals lt ON lt.course_id = c.id
      LEFT JOIN lesson_progress lp ON lp.course_id = c.id
      LEFT JOIN course_purchases cp
        ON cp.course_id = c.id
        AND cp.telegram_id = $1
        AND cp.status = 'paid'
      LEFT JOIN style_agg sa ON sa.course_id = c.id
      WHERE c.is_published = true
    `;

    if (teacherId) {
      params.push(teacherId);
      sql += ` AND c.teacher_id = $${params.length}`;
    }

    if (styleId) {
      params.push(styleId);
      sql += `
        AND EXISTS (
          SELECT 1
          FROM course_styles csf
          WHERE csf.course_id = c.id AND csf.style_id = $${params.length}
        )
      `;
    }

    if (search) {
      params.push(`%${search}%`);
      sql += ` AND (c.title ILIKE $${params.length} OR t.name ILIKE $${params.length})`;
    }

    if (purchasedOnly) {
      sql += ` AND cp.telegram_id IS NOT NULL`;
    }

    sql += ` ORDER BY is_purchased DESC, progress_percent DESC, c.id DESC`;

    const result = await db.query(sql, params);
    res.json(result.rows);
  })
);

app.get(
  "/api/student/course/:courseId",
  requireUser(),
  asyncRoute(async (req, res) => {
    const courseId = Number(req.params.courseId);
    if (!courseId) {
      return res.status(400).json({ error: "Invalid courseId" });
    }

    const params = [req.currentUser.telegram_id, courseId];
    const sql = `
      WITH lesson_totals AS (
        SELECT l.course_id, COUNT(*)::int AS total_lessons
        FROM lessons l
        GROUP BY l.course_id
      ),
      lesson_progress AS (
        SELECT l.course_id, COUNT(*)::int AS completed_lessons
        FROM user_lesson_progress ulp
        JOIN lessons l ON l.id = ulp.lesson_id
        WHERE ulp.telegram_id = $1
        GROUP BY l.course_id
      ),
      style_agg AS (
        SELECT
          cs.course_id,
          json_agg(json_build_object('id', ds.id, 'name', ds.name) ORDER BY ds.name) AS styles
        FROM course_styles cs
        JOIN dance_styles ds ON ds.id = cs.style_id
        GROUP BY cs.course_id
      )
      SELECT
        c.id,
        c.title,
        c.description,
        c.price,
        c.level,
        c.is_published,
        t.id AS teacher_id,
        t.name AS teacher_name,
        t.about_short AS teacher_about_short,
        t.avatar_url AS teacher_avatar_url,
        CASE WHEN cp.telegram_id IS NULL THEN false ELSE true END AS is_purchased,
        COALESCE(lt.total_lessons, 0) AS total_lessons,
        COALESCE(lp.completed_lessons, 0) AS completed_lessons,
        CASE
          WHEN COALESCE(lt.total_lessons, 0) = 0 THEN 0
          ELSE ROUND((COALESCE(lp.completed_lessons, 0)::numeric / lt.total_lessons::numeric) * 100)::int
        END AS progress_percent,
        COALESCE(sa.styles, '[]'::json) AS styles
      FROM courses c
      JOIN teachers t ON t.id = c.teacher_id
      LEFT JOIN lesson_totals lt ON lt.course_id = c.id
      LEFT JOIN lesson_progress lp ON lp.course_id = c.id
      LEFT JOIN course_purchases cp
        ON cp.course_id = c.id
        AND cp.telegram_id = $1
        AND cp.status = 'paid'
      LEFT JOIN style_agg sa ON sa.course_id = c.id
      WHERE c.is_published = true
        AND c.id = $2
      LIMIT 1
    `;

    const result = await db.query(sql, params);
    if (!result.rows[0]) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.json(result.rows[0]);
  })
);

app.get(
  "/api/courses/:teacherId",
  asyncRoute(async (req, res) => {
    const teacherId = Number(req.params.teacherId);
    const styleId = req.query.styleId ? Number(req.query.styleId) : null;
    const telegramId = parseTelegramId(req);

    if (!teacherId) {
      return res.status(400).json({ error: "Invalid teacherId" });
    }

    let sql = `
      SELECT
        c.id,
        c.teacher_id,
        c.title,
        c.description,
        c.price,
        c.level,
        c.is_published,
        ${telegramId ? "CASE WHEN cp.telegram_id IS NULL THEN false ELSE true END" : "false"} AS is_purchased
      FROM courses c
      ${telegramId ? "LEFT JOIN course_purchases cp ON cp.course_id = c.id AND cp.telegram_id = $2 AND cp.status = 'paid'" : ""}
      WHERE c.teacher_id = $1
        AND c.is_published = true
    `;
    const params = [teacherId];
    if (telegramId) params.push(telegramId);

    if (styleId) {
      const styleParamIdx = params.length + 1;
      sql += `
        AND EXISTS (
          SELECT 1
          FROM course_styles cs
          WHERE cs.course_id = c.id AND cs.style_id = $${styleParamIdx}
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
    const telegramId = parseTelegramId(req);
    if (!courseId) {
      return res.status(400).json({ error: "Invalid courseId" });
    }

    const result = await db.query(
      `
        SELECT
          l.id,
          l.lesson_number,
          l.title,
          l.description,
          l.is_free,
          l.duration_sec,
          l.preview_url,
          CASE
            WHEN l.is_free = true THEN true
            WHEN cp.telegram_id IS NOT NULL THEN true
            ELSE false
          END AS is_unlocked
        FROM lessons l
        LEFT JOIN course_purchases cp
          ON cp.course_id = l.course_id
          AND cp.telegram_id = $2
          AND cp.status = 'paid'
        WHERE l.course_id = $1
        ORDER BY l.lesson_number
      `,
      [courseId, telegramId || 0]
    );
    res.json(result.rows);
  })
);

app.post(
  "/api/courses/:courseId/purchase",
  requireUser(),
  asyncRoute(async (req, res) => {
    const courseId = Number(req.params.courseId);
    if (!courseId) {
      return res.status(400).json({ error: "Invalid courseId" });
    }

    const courseResult = await db.query(
      "SELECT id, price FROM courses WHERE id = $1 AND is_published = true",
      [courseId]
    );
    const course = courseResult.rows[0];
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    await db.query(
      `
        INSERT INTO course_purchases (telegram_id, course_id, amount, status, purchased_at)
        VALUES ($1, $2, $3, 'paid', NOW())
        ON CONFLICT (telegram_id, course_id) DO UPDATE
        SET amount = EXCLUDED.amount, status = 'paid', purchased_at = NOW()
      `,
      [req.currentUser.telegram_id, courseId, course.price]
    );

    res.json({ ok: true, course_id: courseId, amount: course.price });
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
    const { name, description, aboutShort, avatarUrl } = req.body;

    const result = await db.query(
      `
        UPDATE teachers
        SET
          name = COALESCE($1, name),
          description = COALESCE($2, description),
          about_short = COALESCE($3, about_short),
          avatar_url = COALESCE($4, avatar_url)
        WHERE id = $5
        RETURNING id, user_id, name, description, about_short, avatar_url
      `,
      [
        typeof name === "string" ? name.trim() : null,
        typeof description === "string" ? description : null,
        typeof aboutShort === "string" ? aboutShort.trim() : null,
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
        SELECT id, teacher_id, title, description, price, is_published, level
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
    const { title, description = "", price = 0, isPublished = true, styleIds = [], level = "beginner" } = req.body;

    if (!title || typeof title !== "string") {
      return res.status(400).json({ error: "title is required" });
    }
    if (!isFiniteNumber(price) || Number(price) < COURSE_MIN_PRICE) {
      return res
        .status(400)
        .json({ error: `course price must be at least ${COURSE_MIN_PRICE}` });
    }
    if (typeof isPublished !== "boolean") {
      return res.status(400).json({ error: "isPublished must be boolean" });
    }
    const safeLevel = asCourseLevel(level);

    const created = await db.query(
      `
        INSERT INTO courses (teacher_id, title, description, price, is_published, level)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, teacher_id, title, description, price, is_published, level
      `,
      [teacher.id, title.trim(), description, Number(price), isPublished, safeLevel]
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

    const { title, description, price, isPublished, styleIds, level } = req.body;

    if (price !== undefined && (!isFiniteNumber(price) || Number(price) < COURSE_MIN_PRICE)) {
      return res
        .status(400)
        .json({ error: `course price must be at least ${COURSE_MIN_PRICE}` });
    }
    if (isPublished !== undefined && typeof isPublished !== "boolean") {
      return res.status(400).json({ error: "isPublished must be boolean" });
    }

    if (level !== undefined && !COURSE_LEVELS.has(String(level).trim().toLowerCase())) {
      return res.status(400).json({ error: "level must be one of: beginner, advanced, professional" });
    }

    const updated = await db.query(
      `
        UPDATE courses
        SET
          title = COALESCE($1, title),
          description = COALESCE($2, description),
          price = COALESCE($3, price),
          is_published = COALESCE($4, is_published),
          level = COALESCE($5, level)
        WHERE id = $6
        RETURNING id, teacher_id, title, description, price, is_published, level
      `,
      [
        typeof title === "string" ? title.trim() : null,
        asOptionalTrimmedString(description),
        price === undefined ? null : Number(price),
        isPublished === undefined ? null : isPublished,
        level === undefined ? null : asCourseLevel(level),
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
    if (!Number.isInteger(Number(lessonNumber)) || Number(lessonNumber) < 1) {
      return res.status(400).json({ error: "lessonNumber must be a positive integer" });
    }
    if (typeof isFree !== "boolean") {
      return res.status(400).json({ error: "isFree must be boolean" });
    }
    if (
      durationSec !== null &&
      (!Number.isInteger(Number(durationSec)) || Number(durationSec) < 1)
    ) {
      return res.status(400).json({ error: "durationSec must be null or positive integer" });
    }

    if (isFree) {
      const existingLesson = await db.query(
        "SELECT id, is_free FROM lessons WHERE course_id = $1 AND lesson_number = $2",
        [courseId, Number(lessonNumber)]
      );
      const existing = existingLesson.rows[0];
      const freeLessonsCount = await countFreeLessonsInCourse(courseId, existing ? existing.id : null);
      if (!existing || existing.is_free === false) {
        if (freeLessonsCount >= MAX_FREE_LESSONS_PER_COURSE) {
          return res.status(400).json({
            error: `Only ${MAX_FREE_LESSONS_PER_COURSE} free lessons are allowed per course`,
          });
        }
      }
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
        title.trim(),
        description,
        isFree,
        durationSec === null ? null : Number(durationSec),
        asOptionalTrimmedString(previewUrl),
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

    const currentLessonResult = await db.query(
      "SELECT id, course_id, is_free FROM lessons WHERE id = $1",
      [lessonId]
    );
    const currentLesson = currentLessonResult.rows[0];

    const {
      title,
      description,
      isFree,
      durationSec,
      previewUrl,
      lessonNumber,
    } = req.body;

    if (isFree !== undefined && typeof isFree !== "boolean") {
      return res.status(400).json({ error: "isFree must be boolean" });
    }
    if (
      durationSec !== undefined &&
      durationSec !== null &&
      (!Number.isInteger(Number(durationSec)) || Number(durationSec) < 1)
    ) {
      return res.status(400).json({ error: "durationSec must be null or positive integer" });
    }
    if (
      lessonNumber !== undefined &&
      (!Number.isInteger(Number(lessonNumber)) || Number(lessonNumber) < 1)
    ) {
      return res.status(400).json({ error: "lessonNumber must be a positive integer" });
    }

    const nextIsFree = isFree === undefined ? currentLesson.is_free : isFree;
    if (nextIsFree && !currentLesson.is_free) {
      const freeLessonsCount = await countFreeLessonsInCourse(currentLesson.course_id, lessonId);
      if (freeLessonsCount >= MAX_FREE_LESSONS_PER_COURSE) {
        return res.status(400).json({
          error: `Only ${MAX_FREE_LESSONS_PER_COURSE} free lessons are allowed per course`,
        });
      }
    }

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
        title === undefined ? null : asOptionalTrimmedString(title),
        description === undefined ? null : asOptionalTrimmedString(description),
        isFree === undefined ? null : isFree,
        durationSec === undefined ? null : durationSec === null ? null : Number(durationSec),
        previewUrl === undefined ? null : asOptionalTrimmedString(previewUrl),
        lessonNumber === undefined ? null : Number(lessonNumber),
        lessonId,
      ]
    );

    res.json(updated.rows[0]);
  })
);

app.get(
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

    const lessons = await db.query(
      `
        SELECT id, course_id, lesson_number, title, description, is_free, duration_sec, preview_url
        FROM lessons
        WHERE course_id = $1
        ORDER BY lesson_number
      `,
      [courseId]
    );
    res.json(lessons.rows);
  })
);

app.get(
  "/api/admin/users",
  requireUser(),
  requireRole("admin"),
  asyncRoute(async (req, res) => {
    const result = await db.query(
      `
        SELECT
          telegram_id,
          role,
          is_onboarded,
          lessons_completed,
          xp,
          first_name,
          last_name,
          username,
          avatar_url
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

app.get(
  "/api/public/config",
  asyncRoute(async (req, res) => {
    res.json({
      bot_username: process.env.TG_BOT_USERNAME || null,
      miniapp_short_name: process.env.TG_MINIAPP_SHORT_NAME || null,
    });
  })
);

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
