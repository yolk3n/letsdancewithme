const db = require("./db");

async function upsertTeacher(name, description, avatarUrl) {
  const result = await db.query(
    `
      INSERT INTO teachers (name, description, avatar_url)
      VALUES ($1, $2, $3)
      ON CONFLICT (name) DO UPDATE
      SET
        description = EXCLUDED.description,
        avatar_url = EXCLUDED.avatar_url
      RETURNING id
    `,
    [name, description, avatarUrl]
  );
  return result.rows[0].id;
}

async function upsertStyle(slug, name) {
  const result = await db.query(
    `
      INSERT INTO dance_styles (slug, name)
      VALUES ($1, $2)
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `,
    [slug, name]
  );
  return result.rows[0].id;
}

async function upsertCourse(teacherId, title, description, price, isPublished) {
  const result = await db.query(
    `
      INSERT INTO courses (teacher_id, title, description, price, is_published)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (teacher_id, title) DO UPDATE
      SET
        description = EXCLUDED.description,
        price = EXCLUDED.price,
        is_published = EXCLUDED.is_published
      RETURNING id
    `,
    [teacherId, title, description, price, isPublished]
  );
  return result.rows[0].id;
}

async function upsertCourseStyle(courseId, styleId) {
  await db.query(
    `
      INSERT INTO course_styles (course_id, style_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `,
    [courseId, styleId]
  );
}

async function upsertLesson(
  courseId,
  lessonNumber,
  title,
  description,
  isFree,
  durationSec,
  previewUrl
) {
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
      ON CONFLICT (course_id, lesson_number) DO UPDATE
      SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        is_free = EXCLUDED.is_free,
        duration_sec = EXCLUDED.duration_sec,
        preview_url = EXCLUDED.preview_url
    `,
    [courseId, lessonNumber, title, description, isFree, durationSec, previewUrl]
  );
}

async function seed() {
  await db.initDb();

  const salsaStyleId = await upsertStyle("salsa", "Salsa");
  const bachataStyleId = await upsertStyle("bachata", "Bachata");

  const alexTeacherId = await upsertTeacher(
    "Алекс",
    "Salsa NY, On2",
    "https://ui-avatars.com/api/?name=%D0%90%D0%BB%D0%B5%D0%BA%D1%81&background=ff4d6d&color=fff"
  );
  const mariaTeacherId = await upsertTeacher(
    "Мария",
    "Bachata, Lady Style",
    "https://ui-avatars.com/api/?name=%D0%9C%D0%B0%D1%80%D0%B8%D1%8F&background=333333&color=fff"
  );

  const salsaCourseId = await upsertCourse(
    alexTeacherId,
    "Salsa NY для начинающих",
    "База, шаги, ритм",
    2990,
    true
  );

  const bachataCourseId = await upsertCourse(
    mariaTeacherId,
    "Bachata с нуля",
    "Основы бачаты",
    2490,
    true
  );

  await upsertCourseStyle(salsaCourseId, salsaStyleId);
  await upsertCourseStyle(bachataCourseId, bachataStyleId);

  await upsertLesson(
    salsaCourseId,
    1,
    "Базовый шаг",
    "Основной шаг salsa NY",
    true,
    480,
    "https://example.com/preview/salsa-1"
  );
  await upsertLesson(
    salsaCourseId,
    2,
    "Правый поворот",
    "Техника поворота",
    true,
    600,
    "https://example.com/preview/salsa-2"
  );
  await upsertLesson(
    salsaCourseId,
    3,
    "Связка",
    "Соединяем движения",
    false,
    720,
    "https://example.com/preview/salsa-3"
  );
  await upsertLesson(
    salsaCourseId,
    4,
    "Комбинация",
    "Продвинутая связка",
    false,
    900,
    "https://example.com/preview/salsa-4"
  );

  await upsertLesson(
    bachataCourseId,
    1,
    "Базовый шаг",
    "Основной шаг бачаты",
    true,
    420,
    "https://example.com/preview/bachata-1"
  );
  await upsertLesson(
    bachataCourseId,
    2,
    "Волна",
    "Работа корпусом",
    false,
    540,
    "https://example.com/preview/bachata-2"
  );

  console.log("Seed completed");
  await db.pool.end();
}

seed().catch(async (error) => {
  console.error("Seed failed", error);
  await db.pool.end();
  process.exit(1);
});
