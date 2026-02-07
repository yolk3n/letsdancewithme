const db = require("./db");

const STYLE_DEFS = [
  { slug: "salsa", name: "Сальса" },
  { slug: "bachata", name: "Бачата" },
  { slug: "kizomba", name: "Кизомба" },
];

const TEACHER_DEFS = [
  {
    name: "Иванов Иван",
    description: "Сальса, бачата",
    aboutShort: "Dance Academy Pro",
    avatarUrl: "https://i.pravatar.cc/300?img=12",
    courses: [
      { title: "Сальса: базовая техника", styleSlug: "salsa", price: 2490, level: "beginner", lessons: 6 },
      { title: "Сальса: партнёрские связки", styleSlug: "salsa", price: 2990, level: "advanced", lessons: 8 },
      { title: "Бачата: музыкальность", styleSlug: "bachata", price: 3190, level: "professional", lessons: 7 },
    ],
  },
  {
    name: "Петрова Анна",
    description: "Бачата, lady style",
    aboutShort: "Lady Style Coach",
    avatarUrl: "https://i.pravatar.cc/300?img=47",
    courses: [
      { title: "Бачата: с нуля", styleSlug: "bachata", price: 2390, level: "beginner", lessons: 5 },
      { title: "Бачата: работа корпусом", styleSlug: "bachata", price: 2890, level: "advanced", lessons: 9 },
      { title: "Бачата: шоу-рутина", styleSlug: "bachata", price: 3390, level: "professional", lessons: 10 },
    ],
  },
  {
    name: "Сидоров Максим",
    description: "Кизомба, body movement",
    aboutShort: "Urban Flow Studio",
    avatarUrl: "https://i.pravatar.cc/300?img=15",
    courses: [
      { title: "Кизомба: основы", styleSlug: "kizomba", price: 2590, level: "beginner", lessons: 6 },
      { title: "Кизомба: ведение и follow", styleSlug: "kizomba", price: 3090, level: "advanced", lessons: 8 },
    ],
  },
  {
    name: "Кузнецова Мария",
    description: "Сальса, кизомба",
    aboutShort: "Senior Dance Instructor",
    avatarUrl: "https://i.pravatar.cc/300?img=32",
    courses: [
      { title: "Сальса: женская техника", styleSlug: "salsa", price: 2790, level: "beginner", lessons: 7 },
      { title: "Кизомба: пластика и flow", styleSlug: "kizomba", price: 3190, level: "advanced", lessons: 8 },
      { title: "Сальса: профессиональный уровень", styleSlug: "salsa", price: 3590, level: "professional", lessons: 10 },
    ],
  },
];

async function clearDb() {
  await db.query(`
    TRUNCATE TABLE
      user_lesson_progress,
      course_purchases,
      lessons,
      course_styles,
      courses,
      dance_styles,
      teachers,
      users
    RESTART IDENTITY CASCADE
  `);
}

async function insertStyle(slug, name) {
  const result = await db.query(
    `
      INSERT INTO dance_styles (slug, name)
      VALUES ($1, $2)
      RETURNING id
    `,
    [slug, name]
  );
  return result.rows[0].id;
}

async function insertTeacher(name, description, aboutShort, avatarUrl) {
  const result = await db.query(
    `
      INSERT INTO teachers (name, description, about_short, avatar_url)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [name, description, aboutShort, avatarUrl]
  );
  return result.rows[0].id;
}

async function insertCourse(teacherId, title, description, price, level) {
  const result = await db.query(
    `
      INSERT INTO courses (teacher_id, title, description, price, level, is_published)
      VALUES ($1, $2, $3, $4, $5, true)
      RETURNING id
    `,
    [teacherId, title, description, price, level]
  );
  return result.rows[0].id;
}

async function attachCourseStyle(courseId, styleId) {
  await db.query(
    `
      INSERT INTO course_styles (course_id, style_id)
      VALUES ($1, $2)
    `,
    [courseId, styleId]
  );
}

async function insertLesson(courseId, lessonNumber, title, description, isFree, durationSec) {
  await db.query(
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
    `,
    [courseId, lessonNumber, title, description, isFree, durationSec, null]
  );
}

function buildLessonTitle(courseTitle, lessonNumber) {
  const cleanCourseTitle = String(courseTitle || "").replace(/^Урок\s*\d+\s*:\s*/i, "").trim();
  return `Практика ${lessonNumber}: ${cleanCourseTitle}`;
}

async function seed() {
  await db.initDb();
  await clearDb();

  const styleIdBySlug = new Map();
  for (const style of STYLE_DEFS) {
    const styleId = await insertStyle(style.slug, style.name);
    styleIdBySlug.set(style.slug, styleId);
  }

  let totalCourses = 0;
  let totalLessons = 0;

  for (const teacherDef of TEACHER_DEFS) {
    const teacherId = await insertTeacher(
      teacherDef.name,
      teacherDef.description,
      teacherDef.aboutShort || null,
      teacherDef.avatarUrl
    );

    for (const courseDef of teacherDef.courses) {
      const styleId = styleIdBySlug.get(courseDef.styleSlug);
      if (!styleId) {
        throw new Error(`Unknown style slug: ${courseDef.styleSlug}`);
      }

      const courseId = await insertCourse(
        teacherId,
        courseDef.title,
        `${courseDef.title}. Полный пошаговый курс.`,
        courseDef.price,
        courseDef.level
      );
      await attachCourseStyle(courseId, styleId);
      totalCourses += 1;

      for (let lessonNumber = 1; lessonNumber <= courseDef.lessons; lessonNumber += 1) {
        const isFree = lessonNumber <= 3;
        const durationSec = 420 + lessonNumber * 45;
        await insertLesson(
          courseId,
          lessonNumber,
          buildLessonTitle(courseDef.title, lessonNumber),
          `Практика по теме "${courseDef.title}", часть ${lessonNumber}.`,
          isFree,
          durationSec
        );
        totalLessons += 1;
      }
    }
  }

  console.log(
    `Seed completed. Teachers: ${TEACHER_DEFS.length}, Courses: ${totalCourses}, Lessons: ${totalLessons}, Styles: ${STYLE_DEFS.length}`
  );
  await db.pool.end();
}

seed().catch(async (error) => {
  console.error("Seed failed", error);
  await db.pool.end();
  process.exit(1);
});
