require("dotenv").config();

const db = require("./db");

async function main() {
  const telegramIdRaw = process.argv[2];
  const telegramId = Number(telegramIdRaw);

  if (!Number.isInteger(telegramId) || telegramId <= 0) {
    console.error("Usage: npm run make-admin -- <telegram_id>");
    process.exit(1);
  }

  await db.initDb();

  const result = await db.query(
    `
      INSERT INTO users (telegram_id, lessons_completed, xp, role, is_onboarded)
      VALUES ($1, 0, 0, 'admin', true)
      ON CONFLICT (telegram_id)
      DO UPDATE SET role = 'admin'
      RETURNING telegram_id, role, is_onboarded
    `,
    [telegramId]
  );

  console.log("Admin granted:", result.rows[0]);
  await db.pool.end();
}

main().catch(async (error) => {
  console.error("Failed to grant admin role:", error.message);
  try {
    await db.pool.end();
  } catch {
    // ignore close errors
  }
  process.exit(1);
});
