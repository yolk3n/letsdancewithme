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

async function completeLesson(telegramId, lessonNumber) {
  return db.withTransaction(async (client) => {
    await client.query(
      `
        INSERT INTO users (telegram_id, lessons_completed, xp, role, is_onboarded)
        VALUES ($1, 0, 0, 'student', false)
        ON CONFLICT (telegram_id) DO NOTHING
      `,
      [telegramId]
    );

    const userResult = await client.query(
      "SELECT telegram_id, lessons_completed, xp, role, is_onboarded FROM users WHERE telegram_id = $1 FOR UPDATE",
      [telegramId]
    );

    const user = userResult.rows[0];

    if (lessonNumber > 3 && user.lessons_completed >= 3) {
      return { blocked: true };
    }

    if (lessonNumber > user.lessons_completed) {
      const nextLessonsCompleted = lessonNumber;
      const nextXp = user.xp + 10;

      await client.query(
        "UPDATE users SET lessons_completed = $1, xp = $2 WHERE telegram_id = $3",
        [nextLessonsCompleted, nextXp, telegramId]
      );

      return {
        blocked: false,
        lessons_completed: nextLessonsCompleted,
        xp: nextXp,
      };
    }

    return {
      blocked: false,
      lessons_completed: user.lessons_completed,
      xp: user.xp,
    };
  });
}

module.exports = {
  getOrCreateUser,
  setOnboardingComplete,
  completeLesson,
};
