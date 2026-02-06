const db = require("./db");

async function getOrCreateUser(telegramId) {
  await db.query(
    `
      INSERT INTO users (telegram_id, lessons_completed, xp, role, is_onboarded)
      VALUES ($1, 0, 0, 'student', false)
      ON CONFLICT (telegram_id) DO NOTHING
    `,
    [telegramId]
  );

  const result = await db.query(
    "SELECT telegram_id, lessons_completed, xp, role, is_onboarded FROM users WHERE telegram_id = $1",
    [telegramId]
  );

  return result.rows[0];
}

async function setOnboardingComplete(telegramId) {
  const result = await db.query(
    `
      UPDATE users
      SET is_onboarded = true
      WHERE telegram_id = $1
      RETURNING telegram_id, lessons_completed, xp, role, is_onboarded
    `,
    [telegramId]
  );

  return result.rows[0];
}

async function completeLesson(telegramId, courseId, lessonNumber) {
  return db.withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO users (telegram_id, lessons_completed, xp, role, is_onboarded)
        VALUES ($1, 0, 0, 'student', false)
        ON CONFLICT (telegram_id) DO NOTHING
      `,
      [telegramId]
    );

    const lessonResult = await client.query(
      `
        SELECT id, course_id, lesson_number, is_free
        FROM lessons
        WHERE course_id = $1 AND lesson_number = $2
        FOR UPDATE
      `,
      [courseId, lessonNumber]
    );

    const lesson = lessonResult.rows[0];
    if (!lesson) {
      return { blocked: true, reason: "lesson_not_found" };
    }

    if (!lesson.is_free) {
      const purchaseResult = await client.query(
        `
          SELECT 1
          FROM course_purchases
          WHERE telegram_id = $1 AND course_id = $2 AND status = 'paid'
        `,
        [telegramId, courseId]
      );

      if (!purchaseResult.rows[0]) {
        return { blocked: true, reason: "course_purchase_required" };
      }
    }

    const alreadyCompletedResult = await client.query(
      `
        SELECT 1
        FROM user_lesson_progress
        WHERE telegram_id = $1 AND lesson_id = $2
      `,
      [telegramId, lesson.id]
    );

    if (alreadyCompletedResult.rows[0]) {
      const user = await client.query(
        "SELECT lessons_completed, xp FROM users WHERE telegram_id = $1",
        [telegramId]
      );
      return {
        blocked: false,
        lessons_completed: user.rows[0].lessons_completed,
        xp: user.rows[0].xp,
      };
    }

    await client.query(
      `
        INSERT INTO user_lesson_progress (telegram_id, lesson_id)
        VALUES ($1, $2)
      `,
      [telegramId, lesson.id]
    );

    const updatedUserResult = await client.query(
      `
        UPDATE users
        SET
          lessons_completed = lessons_completed + 1,
          xp = xp + 10
        WHERE telegram_id = $1
        RETURNING lessons_completed, xp
      `,
      [telegramId]
    );

    return {
      blocked: false,
      lessons_completed: updatedUserResult.rows[0].lessons_completed,
      xp: updatedUserResult.rows[0].xp,
    };
  });
}

module.exports = {
  getOrCreateUser,
  setOnboardingComplete,
  completeLesson,
};
