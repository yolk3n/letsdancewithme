require("dotenv").config();

const { Bot, InlineKeyboard, Keyboard } = require("grammy");
const db = require("./db");
const { getOrCreateUser, completeLesson } = require("./userService");

const bot = new Bot(process.env.BOT_TOKEN);

const mainMenu = new Keyboard()
  .text("👩‍🏫 Выбрать преподавателя")
  .row()
  .text("ℹ️ О проекте")
  .resized();

const miniAppKeyboard = new InlineKeyboard().webApp(
  "🚀 Открыть обучение",
  "https://letsdancewithme.onrender.com"
);

const teachersMenu = new Keyboard()
  .text("🕺 Алекс — Salsa NY")
  .row()
  .text("🔙 Назад")
  .resized();

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

bot.command("start", async (ctx) => {
  await getOrCreateUser(ctx.from.id);
  await ctx.reply(
    "💃 *Let's Dance With Me* 🕺\nДобро пожаловать!\nОткрой обучение:",
    {
      parse_mode: "Markdown",
      reply_markup: miniAppKeyboard,
    }
  );
});

bot.hears("ℹ️ О проекте", async (ctx) => {
  await getOrCreateUser(ctx.from.id);
  await ctx.reply("Это онлайн-школа танцев. Покупка идет на уровне курса, а не отдельных уроков.");
});

bot.hears("👩‍🏫 Выбрать преподавателя", async (ctx) => {
  await getOrCreateUser(ctx.from.id);
  await ctx.reply("Выбери преподавателя:", { reply_markup: teachersMenu });
});

bot.hears("🕺 Алекс — Salsa NY", async (ctx) => {
  await getOrCreateUser(ctx.from.id);
  await ctx.reply("*Курс:* Salsa NY для начинающих\nВыбери урок:", {
    parse_mode: "Markdown",
    reply_markup: lessonsMenu,
  });
});

function getLevel(xp) {
  if (xp >= 60) return "💃 Танцор";
  if (xp >= 30) return "🥋 Ученик";
  return "🌱 Новичок";
}

async function handleLesson(ctx, lessonNumber) {
  await getOrCreateUser(ctx.from.id);
  const defaultCourseId = 1;
  const result = await completeLesson(ctx.from.id, defaultCourseId, lessonNumber);

  if (result.blocked) {
    const lockedMessage =
      result.reason === "course_purchase_required"
        ? "🔒 Этот урок доступен после покупки курса."
        : "🔒 Этот урок сейчас недоступен.";
    await ctx.reply(`${lockedMessage}\nОткрой Mini App, чтобы продолжить.`);
    return;
  }

  const level = getLevel(result.xp);
  await ctx.reply(`✅ Урок ${lessonNumber} пройден!\n⭐ XP: ${result.xp}\n🎖 Уровень: ${level}`);
}

bot.hears("Урок 1 — Базовый шаг", async (ctx) => handleLesson(ctx, 1));
bot.hears("Урок 2 — Правый поворот", async (ctx) => handleLesson(ctx, 2));
bot.hears("Урок 3 — Левая связка", async (ctx) => handleLesson(ctx, 3));
bot.hears("Урок 4 — Комбинация 🔒", async (ctx) => handleLesson(ctx, 4));

bot.hears("🔙 Назад", async (ctx) => {
  await getOrCreateUser(ctx.from.id);
  await ctx.reply("Главное меню:", { reply_markup: mainMenu });
});

async function startBot() {
  await db.initDb();
  await bot.start();
  console.log("Бот запущен");
}

startBot().catch((error) => {
  console.error("Failed to start bot", error);
  process.exit(1);
});
