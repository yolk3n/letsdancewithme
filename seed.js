const db = require("./db");

async function upsertTeacher(name, description) {
  const result = await db.query(
    `
      INSERT INTO teachers (name, description)
      VALUES ($1, $2)
      ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
      RETURNING id
    `,
    [name, description]
  );
  return result.rows[0].id;
}

async function upsertCourse(teacherId, title, description) {
  const result = await db.query(
    `
      INSERT INTO courses (teacher_id, title, description)
      VALUES ($1, $2, $3)
      ON CONFLICT (teacher_id, title) DO UPDATE SET description = EXCLUDED.description
      RETURNING id
    `,
    [teacherId, title, description]
  );
  return result.rows[0].id;
}

async function upsertLesson(courseId, lessonNumber, title, description) {
  await db.query(
    `
      INSERT INTO lessons (course_id, lesson_number, title, description)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (course_id, lesson_number) DO UPDATE
      SET title = EXCLUDED.title, description = EXCLUDED.description
    `,
    [courseId, lessonNumber, title, description]
  );
}

async function seed() {
  await db.initDb();

  const alexTeacherId = await upsertTeacher("Алекс", "Salsa NY, On2");
  const mariaTeacherId = await upsertTeacher("Мария", "Bachata, Lady Style");

  const salsaCourseId = await upsertCourse(
    alexTeacherId,
    "Salsa NY для начинающих",
    "База, шаги, ритм"
  );
  const bachataCourseId = await upsertCourse(
    mariaTeacherId,
    "Bachata с нуля",
    "Основы бачаты"
  );

  await upsertLesson(salsaCourseId, 1, "Базовый шаг", "Основной шаг salsa NY");
  await upsertLesson(salsaCourseId, 2, "Правый поворот", "Техника поворота");
  await upsertLesson(salsaCourseId, 3, "Связка", "Соединяем движения");
  await upsertLesson(salsaCourseId, 4, "Комбинация", "Продвинутая связка");

  await upsertLesson(bachataCourseId, 1, "Базовый шаг", "Основной шаг бачаты");
  await upsertLesson(bachataCourseId, 2, "Волна", "Работа корпусом");

  console.log("Seed completed");
  await db.pool.end();
}

seed().catch(async (error) => {
  console.error("Seed failed", error);
  await db.pool.end();
  process.exit(1);
});
