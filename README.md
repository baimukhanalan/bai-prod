# BAI.PROD — Telegram Mini App + Bot

Production-oriented monorepo for a Telegram academy/community: grammY onboarding bot, Fastify API, PostgreSQL/Prisma, OpenAI mentor and React Mini App. The interface closely follows the supplied B-PROD CLUB screenshots in a premium black-and-silver system.

## Implemented

- Bot FSM: name, optional contact, age, location, occupation, income and 3-month goal; restart/cancel/app commands, admin approval and Mini App menu button.
- Bot automation: intro lesson and private-channel CTA, daily task plan, Monday curator prompt, weekly interest-based match, consent-based contact exchange and retryable PostgreSQL outbox.
- Telegram authentication: fresh `initData` HMAC validation, future/expired timestamp rejection, blocked-user enforcement and 12-hour JWT.
- 1–3–5 tasks: unlimited planning, XP for the first 1/3/5 tasks of each type per day, optimistic UI, idempotent completion, transactional XP ledger and deletion rollback.
- Academy: published courses, access tiers, sequential lessons, progress and XP.
- OpenAI mentor: profile-aware Responses API prompt, atomic daily quota and failure refund.
- Networking, connection requests, monthly/all-time XP leaderboards and Telegram notifications.
- Profile, discoverability, 28-day discipline grid, streaks, result journal and curator requests.
- Health/readiness endpoints, validation, security headers, CORS allowlist, rate limits and graceful shutdown.
- Reproducible Prisma migration, seed, multi-stage containers and production Compose stack.

### Multi-user guarantees

- Every private query and mutation is scoped by the authenticated database `userId`; client-supplied user identifiers are never trusted.
- Telegram identity is unique by `telegram_id`; JWT authentication rechecks the current database status on every protected request.
- Task, academy, result, activity and AI quota state is isolated per user. XP source keys and result idempotency keys use composite per-user uniqueness.
- Serializable transactions with bounded backoff protect task XP slots, XP ledger updates and daily quotas under concurrent requests.
- PostgreSQL enforces one active curator booking per user with a partial unique index, including simultaneous requests.
- Networking and leaderboards intentionally expose only approved public profile fields; phone, income and onboarding answers are not returned.
- Telegram contacts remain private until the receiving participant accepts. Direction-independent pair keys prevent duplicate A→B/B→A requests.
- Bot delivery uses `FOR UPDATE SKIP LOCKED`, delivery leases and unique dedupe keys, so restarts and multiple bot replicas do not duplicate scheduled messages.

### Bot communication schedule

- After approval: the intro AI lesson and buttons for the lesson, closed channel and Mini App. An approved user can request it again once per day with `/lesson`.
- Daily at `DAILY_PLAN_HOUR`: every registered user receives the exact number of unfinished tasks for their local date and a `✅ Дисциплина` WebApp button, including profiles still awaiting approval.
- Monday at `WEEKLY_CURATOR_HOUR`: curator prompt with the code word `Разбор`.
- Monday at `WEEKLY_MATCH_HOUR`: the strongest new candidate by complementary `Даю / Ищу` tags, then a consent request. Contacts are sent to both users only after acceptance.

Set `BOT_TIME_ZONE`, `INTRO_LESSON_URL`, `CLOSED_CHANNEL_URL` and `CURATOR_URL` to real production values. Every scheduled delivery is persisted in `bot_notifications`; failures retry up to eight times and retain the last error for operations review.
`BOT_TIME_ZONE` is the default for new users. Each participant can set an individual IANA zone with `/timezone Europe/Moscow`; all daily and Monday schedules are then calculated in that zone.

## Project layout

```text
apps/api/   Fastify REST API, auth, AI and product logic
apps/bot/   grammY onboarding and admin moderation
apps/web/   React/Vite Telegram Mini App
prisma/     schema, migration and seed content
deploy/     nginx production configuration
```

## Local development

Requirements: Node.js 22+, PostgreSQL 16+ and HTTPS tunnelling for tests inside Telegram.

1. Keep secrets in `.env.local` (ignored by Git) and fill the non-OpenAI values from `.env.example`. Do not overwrite the securely created `OPENAI_API_KEY`.
2. Start PostgreSQL, deploy the committed schema and seed product content:

```bash
npm ci
npm run db:deploy
npm run db:seed
```

3. Run everything:

```bash
npm run dev
```

`npm run dev:web` starts only the visual UI. Browser demo data is compiled only by Vite development mode; a production build without Telegram `initData` shows an authentication error and never bypasses the backend.

## Production deployment

1. Copy `.env.production.example` to `.env.production` and store real values through the host secret manager. Use the same strong password in `POSTGRES_PASSWORD` and the internal `DATABASE_URL`. The file is Git-ignored.
2. Point `app.yourdomain.com` to the web service and `api.yourdomain.com` to port 4000 behind TLS. Set `PUBLIC_API_URL` to the public API origin and keep only trusted frontend origins in `CORS_ORIGINS`.
3. Build and start the stack:

```bash
docker compose --env-file .env.production -f docker-compose.production.yml up -d --build
docker compose --env-file .env.production -f docker-compose.production.yml ps
```

The API container runs `prisma migrate deploy` before listening. The bot waits for API readiness, and PostgreSQL data lives in the named `bai_prod_data` volume.

4. In BotFather:

- set the Mini App/menu URL to the exact HTTPS `WEBAPP_URL`;
- set the production bot token as `BOT_TOKEN`;
- optionally configure the bot description and profile image;
- verify `/start`, the contact button, full questionnaire, approval and `Open BAI.PROD` on a real Telegram account.

For automatic access after onboarding set `AUTO_APPROVE_USERS=true`. For moderated access leave it `false`, set `ADMIN_CHAT_ID`, and approve with the inline admin button or `/approve TELEGRAM_ID`.

## Verification

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
npm audit --omit=dev
DATABASE_URL='postgresql://user:pass@127.0.0.1:5432/bai_prod' npx prisma validate
```

### End-to-end tests

`npm run test:e2e` runs both layers:

- `test:e2e:api` starts an isolated temporary PostgreSQL instance (or an isolated schema from `TEST_DATABASE_URL`), deploys the committed migration, seeds content, starts the compiled API and verifies Telegram HMAC/JWT, two-user isolation, cross-user mutation denial, per-user idempotency, concurrent task XP caps, shared lesson XP, planning, activity, networking, leaderboard, curator booking races and cleanup. If a protected `OPENAI_API_KEY` is available, it also verifies one real mentor answer. Set `E2E_REQUIRE_OPENAI=1` to make that provider check mandatory.
- `test:e2e:web` starts Vite and executes the main Mini App flows in desktop and mobile Chromium. On macOS it uses the installed Chrome channel. In CI install Chromium with `npx playwright install --with-deps chromium`.

To use an existing test PostgreSQL server without touching its public schema:

```bash
TEST_DATABASE_URL='postgresql://user:password@127.0.0.1:5432/bai_prod_test' npm run test:e2e:api
```

The runner creates and removes a unique `e2e_*` schema. Never point `TEST_DATABASE_URL` at a database account that is not allowed to create and drop temporary schemas.

Runtime checks after deployment:

```bash
curl -fsS https://api.yourdomain.com/health
curl -fsS https://api.yourdomain.com/ready
```

Full provider E2E additionally requires a real `BOT_TOKEN`, reachable HTTPS domains and a PostgreSQL deployment. Do not declare go-live from a frontend build alone: test Telegram `initData`, one real OpenAI mentor answer, onboarding persistence, XP rollback and admin notifications in the deployed environment.
