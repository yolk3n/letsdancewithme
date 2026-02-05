const db = require("./db");

function getOrCreateUser(telegramId) {
  let user = db
    .prepare("SELECT * FROM users WHERE telegram_id = ?")
    .get(telegramId);

  if (!user) {
    db.prepare(
      "INSERT INTO users (telegram_id, lessons_completed, xp) VALUES (?, 0, 0)"
    ).run(telegramId);

    user = { telegram_id: telegramId, lessons_completed: 0, xp: 0 };
  }

  return user;
}

function completeLesson(telegramId, lessonNumber) {
  const user = getOrCreateUser(telegramId);

  if (lessonNumber > 3 && user.lessons_completed >= 3) {
    return { blocked: true };
  }

  if (lessonNumber > user.lessons_completed) {
    user.lessons_completed = lessonNumber;
    user.xp += 10;

    db.prepare(
      "UPDATE users SET lessons_completed = ?, xp = ? WHERE telegram_id = ?"
    ).run(user.lessons_completed, user.xp, telegramId);
  }

  return {
    blocked: false,
    lessons_completed: user.lessons_completed,
    xp: user.xp,
  };
}

module.exports = {
  getOrCreateUser,
  completeLesson,
};
