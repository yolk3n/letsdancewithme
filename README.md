# Let's Dance With Me

Telegram bot + Telegram Mini App for dance courses.

## Stack

- Node.js (CommonJS)
- Express
- grammY (Telegram bot)
- PostgreSQL (`pg`)

## Services

- `index.js` - Telegram bot
- `server.js` - API + static Mini App hosting (`web/index.html`)
- `db.js` - DB connection + schema init/migrations
- `seed.js` - idempotent seed

## Environment Variables

Required:

- `DATABASE_URL` - PostgreSQL connection string
- `BOT_TOKEN` - Telegram bot token (for `index.js`)

Optional:

- `DATABASE_SSL=true` - enable SSL for DB connection (recommended on Render)
- `PORT` - API port (default `3000`)
- `TG_BOT_USERNAME` - bot username for Mini App deep links (without `@`)
- `TG_MINIAPP_SHORT_NAME` - Mini App short name (if set in BotFather)

## Run

```bash
npm install
npm run seed
npm start
# in separate process:
npm run bot
```

## Current Business Rules

- User buys **course**, not individual lessons.
- Course minimum price: **199 RUB**.
- Each course can have maximum **3 free lessons**.
- Paid lessons are unlocked only after course purchase.

## Main API (short)

- `GET /api/me`
- `POST /api/onboarding/complete`
- `GET /api/teachers`
- `GET /api/styles`
- `GET /api/courses/:teacherId`
- `GET /api/lessons/:courseId`
- `POST /api/courses/:courseId/purchase`
- `POST /api/lesson`

Teacher:

- `GET /api/teacher/profile`
- `PUT /api/teacher/profile`
- `GET /api/teacher/courses`
- `POST /api/teacher/courses`
- `PUT /api/teacher/courses/:courseId`
- `GET /api/teacher/courses/:courseId/lessons`
- `POST /api/teacher/courses/:courseId/lessons`
- `PUT /api/teacher/lessons/:lessonId`

Admin:

- `GET /api/admin/users`
- `PUT /api/admin/users/:telegramId/role`

## Notes for Render

- Add env vars in each service separately (API and bot if split):
  - `DATABASE_URL`
  - `DATABASE_SSL=true`
  - `BOT_TOKEN` (bot service)
- If API and DB are in Render, use Internal DB URL when possible.
