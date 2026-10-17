<div align="center">

# BAI.PROD

**A Telegram-native academy platform — onboarding bot, API, and a gamified Mini App**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?style=for-the-badge&logo=fastify&logoColor=white)](https://fastify.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?style=for-the-badge&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-17-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Telegram](https://img.shields.io/badge/Telegram-grammY-26A5E4?style=for-the-badge&logo=telegram&logoColor=white)](https://grammy.dev/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

</div>

---

## 📖 About

**BAI.PROD** is a production-oriented monorepo for running a Telegram academy and community. New members are onboarded through a conversational bot, their identity is verified via signed Telegram `initData`, and they progress inside a React Telegram Mini App that gamifies daily discipline with XP, tasks, courses, and peer networking. An OpenAI-backed mentor answers profile-aware questions under a per-user daily quota.

The codebase is organized as three TypeScript workspaces — a bot, an API, and a web client — that share a single PostgreSQL database modeled with Prisma.

## ✨ Features

- 🤖 **grammY onboarding bot with FSM** — a finite-state questionnaire (name, contact, age, location, occupation, income, 3-month goal, give/seek tags) with restart/cancel commands, admin approval, and a Mini App menu button.
- 📅 **Scheduled automation** — intro lesson and private-channel CTA, daily task plans, a Monday curator prompt, and weekly interest-based matching with consent-based contact exchange, backed by a retryable PostgreSQL outbox (`FOR UPDATE SKIP LOCKED`, delivery leases, dedupe keys).
- ⚡ **Fastify API** — health/readiness endpoints, Zod validation, Helmet security headers, a CORS allowlist, rate limiting, and graceful shutdown.
- 🔐 **Telegram authentication** — fresh `initData` HMAC validation, future/expired timestamp rejection, blocked-user enforcement, and short-lived JWTs rechecked on every protected request.
- 🗄️ **Prisma + PostgreSQL** — a committed schema with reproducible migrations and seed content; per-user data isolation enforced through composite uniqueness and serializable transactions.
- 🧠 **OpenAI mentor** — a profile-aware prompt with an atomic daily quota and a failure refund so failed calls don't burn a user's allowance.
- 📱 **React Telegram Mini App** — Home, Academy, Mentor, People, and Profile screens covering XP and the 1–3–5 task system, published courses with sequential lessons, networking and connection requests, monthly/all-time leaderboards, a 28-day discipline grid, and streaks.

## 🖼️ Screenshots

<!-- Add Mini App screenshots here, e.g.:
![Home](docs/screenshots/home.png)
![Academy](docs/screenshots/academy.png)
![Mentor](docs/screenshots/mentor.png)
-->

## 🏗️ Architecture

A npm-workspaces monorepo with three deployable apps over one Prisma/PostgreSQL data layer:

```text
apps/api/   Fastify REST API — auth, AI mentor, tasks, academy, networking
apps/bot/   grammY onboarding, admin moderation, scheduled automation
apps/web/   React + Vite Telegram Mini App
prisma/     schema, migrations, and seed content
deploy/     nginx production configuration
```

The bot and API share the database and communicate through persisted records (the notification outbox). The web client talks only to the API, which is the single trusted authority for identity and state.

## 🧰 Tech Stack

| Layer      | Technologies |
| ---------- | ------------ |
| Language   | TypeScript 5.9, npm workspaces |
| Bot        | grammY, OpenAI SDK, Zod |
| API        | Fastify 5, `@fastify/jwt`, `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`, OpenAI SDK, Zod |
| Web        | React 19, Vite 7, Phosphor & Lucide icons |
| Data       | PostgreSQL 17, Prisma 6 |
| Testing    | Node test runner, Playwright (desktop + mobile Chromium) |
| Infra      | Docker (multi-stage), Docker Compose (dev + prod), nginx, Vercel (web) |

## 🚀 Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL 17 (or Docker)
- A Telegram bot token from [@BotFather](https://t.me/BotFather)
- An OpenAI API key (for the mentor)

### 1. Install

```bash
git clone https://github.com/baimukhanalan/bai-prod.git
cd bai-prod
npm ci
```

### 2. Configure environment

```bash
cp .env.example .env.local
# fill in BOT_TOKEN, JWT_SECRET (32+ chars), OPENAI_API_KEY,
# WEBAPP_URL, CORS_ORIGINS, DATABASE_URL, and schedule values
```

### 3. Start PostgreSQL (Docker) and set up the database

```bash
docker compose up -d        # local Postgres on :5432
npm run db:deploy           # apply committed migrations
npm run db:seed             # seed product content
```

### 4. Run the apps

```bash
npm run dev                 # web + api + bot together

# or individually:
npm run dev:web             # Vite Mini App
npm run dev:api             # Fastify API (:4000)
npm run dev:bot             # grammY bot
```

### Verify

```bash
npm run typecheck
npm test                    # unit tests (api + bot)
npm run test:e2e            # API + web end-to-end suites
npm run build
```

## 📂 Project Structure

```text
.
├── apps/
│   ├── api/            Fastify API (server, auth, gamification, db, env)
│   ├── bot/            grammY bot (onboarding, automation, matching, messages)
│   └── web/            React Mini App (screens, api client, components)
├── prisma/
│   ├── schema.prisma   data model (users, tasks, courses, XP, bookings…)
│   ├── migrations/     committed SQL migrations
│   └── seed.ts         seed content
├── deploy/             nginx configuration
├── e2e/                API end-to-end runner
├── Dockerfile.api | Dockerfile.bot | Dockerfile.web
├── docker-compose.yml             # local Postgres
├── docker-compose.production.yml  # full prod stack
├── playwright.config.ts
└── vercel.json
```

## 🗺️ Roadmap

- [x] grammY onboarding bot with FSM and admin approval
- [x] Telegram `initData` authentication and JWT sessions
- [x] 1–3–5 task system with transactional XP ledger
- [x] Academy courses, lessons, and progress
- [x] OpenAI mentor with per-user daily quota
- [x] Networking, connection requests, and leaderboards
- [x] Docker Compose production stack and Prisma migrations
- [ ] Optional group-chat AI assistant (scaffolded, disabled by default)
- [ ] Push beyond Chromium coverage in e2e tests
- [ ] Public documentation site and screenshots

## 📄 License

Released under the [MIT License](LICENSE).
