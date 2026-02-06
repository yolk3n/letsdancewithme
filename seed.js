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
    avatarUrl: "https://ui-avatars.com/api/?name=%D0%98%D0%B2%D0%B0%D0%BD%D0%BE%D0%B2+%D0%98%D0%B2%D0%B0%D0%BD&background=1f6feb&color=fff",
    courses: [
      { title: "Сальса: базовая техника", styleSlug: "salsa", price: 2490, level: "beginner", lessons: 6 },
      { title: "Сальса: партнёрские связки", styleSlug: "salsa", price: 2990, level: "advanced", lessons: 8 },
      { title: "Бачата: музыкальность", styleSlug: "bachata", price: 3190, level: "professional", lessons: 7 },
    ],
  },
  {
    name: "Петрова Анна",
    description: "Бачата, lady style",
    avatarUrl: "https://ui-avatars.com/api/?name=%D0%9F%D0%B5%D1%82%D1%80%D0%BE%D0%B2%D0%B0+%D0%90%D0%BD%D0%BD%D0%B0&background=d63384&color=fff",
    courses: [
      { title: "Бачата: с нуля", styleSlug: "bachata", price: 2390, level: "beginner", lessons: 5 },
      { title: "Бачата: работа корпусом", styleSlug: "bachata", price: 2890, level: "advanced", lessons: 9 },
      { title: "Бачата: шоу-рутина", styleSlug: "bachata", price: 3390, level: "professional", lessons: 10 },
    ],
  },
  {
    name: "Сидоров Максим",
    description: "Кизомба, body movement",
    avatarUrl: "https://ui-avatars.com/api/?name=%D0%A1%D0%B8%D0%B4%D0%BE%D1%80%D0%BE%D0%B2+%D0%9C%D0%B0%D0%BA%D1%81%D0%B8%D0%BC&background=198754&color=fff",
    courses: [
      { title: "Кизомба: основы", styleSlug: "kizomba", price: 2590, level: "beginner", lessons: 6 },
      { title: "Кизомба: ведение и follow", styleSlug: "kizomba", price: 3090, level: "advanced", lessons: 8 },
    ],
  },
  {
    name: "Кузнецова Мария",
    description: "Сальса, кизомба",
    avatarUrl: "https://ui-avatars.com/api/?name=%D0%9A%D1%83%D0%B7%D0%BD%D0%B5%D1%86%D0%BE%D0%B2%D0%B0+%D0%9C%D0%B0%D1%80%D0%B8%D1%8F&background=f59f00&color=fff",
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

async function insertTeacher(name, description, avatarUrl) {
  const result = await db.query(
    `
      INSERT INTO teachers (name, description, avatar_url)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [name, description, avatarUrl]
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
          `Урок ${lessonNumber}: ${courseDef.title}`,
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
