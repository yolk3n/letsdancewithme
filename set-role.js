require("dotenv").config();

const db = require("./db");
const ALLOWED_ROLES = new Set(["student", "teacher", "admin"]);

async function main() {
  const telegramIdRaw = process.argv[2];
  const roleRaw = (process.argv[3] || "admin").toString().trim().toLowerCase();
  const telegramId = Number(telegramIdRaw);

  if (!Number.isInteger(telegramId) || telegramId <= 0) {
    console.error("Usage: npm run set-role -- <telegram_id> [student|teacher|admin]");
    process.exit(1);
  }

  if (!ALLOWED_ROLES.has(roleRaw)) {
    console.error(`Invalid role: ${roleRaw}. Allowed roles: student, teacher, admin`);
    process.exit(1);
  }

  await db.initDb();

  const result = await db.query(
    `
      INSERT INTO users (telegram_id, lessons_completed, xp, role, is_onboarded)
      VALUES ($1, 0, 0, $2, true)
      ON CONFLICT (telegram_id)
      DO UPDATE SET role = $2
      RETURNING telegram_id, role, is_onboarded
    `,
    [telegramId, roleRaw]
  );

  console.log("Role updated:", result.rows[0]);
  await db.pool.end();
}

main().catch(async (error) => {
  console.error("Failed to update role:", error.message);
  try {
    await db.pool.end();
  } catch {
    // ignore close errors
  }
  process.exit(1);
});
