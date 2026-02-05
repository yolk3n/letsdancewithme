require("dotenv").config();

const { InlineKeyboard } = require("grammy");

const db = require("./db");
const { Bot, Keyboard } = require("grammy");
const bot = new Bot(process.env.BOT_TOKEN);
const { completeLesson } = require("./userService");

// Главное меню
const mainMenu = new Keyboard()
  .text("👩‍🏫 Выбрать преподавателя")
  .row()
  .text("ℹ️ О проекте")
  .resized();

const miniAppKeyboard = new InlineKeyboard().webApp(
  "🚀 Открыть обучение",
  "https://letsdancewithme.onrender.com"
);

// Меню преподавателей
const teachersMenu = new Keyboard()
  .text("🕺 Алекс — Salsa NY")
  .row()
  .text("🔙 Назад")
  .resized();

// Меню уроков
const lessonsMenu = new Keyboard()
  .text("Урок 1 — Базовый шаг")
  .row()
  .text("Урок 2 — Правый поворот")
  .row()
  .text("Урок 3 — Левая связка")
  .row()
  .text("Урок 4 — Комбинация 🔒")
  .row()
  .text("🔙 Назад")
  .resized();

bot.command("start", (ctx) => {
  ctx.reply(
    "💃 *Let's Dance With Me* 🕺\nДобро пожаловать!\nОткрой обучение:",
    {
      parse_mode: "Markdown",
      reply_markup: miniAppKeyboard,
    }
  );
});

bot.hears("ℹ️ О проекте", (ctx) => {
  ctx.reply(
    "Это онлайн-школа танцев.\nПервые уроки бесплатные, дальше — подписка."
  );
});

bot.hears("👩‍🏫 Выбрать преподавателя", (ctx) => {
  ctx.reply("Выбери преподавателя:", {
    reply_markup: teachersMenu,
  });
});

bot.hears("🕺 Алекс — Salsa NY", (ctx) => {
  ctx.reply(
    "*Курс:* Salsa NY для начинающих\nВыбери урок:",
    {
      parse_mode: "Markdown",
      reply_markup: lessonsMenu,
    }
  );
});

// ===== ЛОГИКА УРОКОВ =====

function handleLesson(ctx, lessonNumber) {
  const userId = ctx.from.id;

  const result = completeLesson(userId, lessonNumber);

  if (result.blocked) {
    ctx.reply(
      "🔒 Этот урок доступен по подписке.\nОформи подписку, чтобы продолжить обучение 💃"
    );
    return;
  }

  const level = getLevel(result.xp);

  ctx.reply(
    `✅ Урок ${lessonNumber} пройден!\n⭐ XP: ${result.xp}\n🏅 Уровень: ${level}`
  );
}

function getLevel(xp) {
  if (xp >= 60) return "💃 Танцор";
  if (xp >= 30) return "🥋 Ученик";
  return "🌱 Новичок";
}


bot.hears("Урок 1 — Базовый шаг", (ctx) => handleLesson(ctx, 1));
bot.hears("Урок 2 — Правый поворот", (ctx) => handleLesson(ctx, 2));
bot.hears("Урок 3 — Левая связка", (ctx) => handleLesson(ctx, 3));
bot.hears("Урок 4 — Комбинация 🔒", (ctx) => handleLesson(ctx, 4));

bot.hears("🔙 Назад", (ctx) => {
  ctx.reply("Главное меню:", {
    reply_markup: mainMenu,
  });
});

bot.start();
console.log("Бот запущен 🚀");
