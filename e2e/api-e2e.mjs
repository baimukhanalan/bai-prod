import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local'), quiet: true });

const botToken = '123456:BAI_PROD_LOCAL_E2E_TOKEN';
const jwtSecret = 'bai-prod-local-e2e-jwt-secret-with-at-least-32-characters';
const hasLiveOpenAI = process.env.E2E_SKIP_OPENAI !== '1'
  && Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.length >= 20);
let apiProcess;
let postgresProcess;
let temporaryDatabaseDirectory;
let databaseUrl;
let externalSchema;
let prisma;

function stage(message) {
  process.stdout.write(`[e2e:api] ${message}\n`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function commandExists(command) {
  return spawnSync('which', [command], { stdio: 'ignore' }).status === 0;
}

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`);
  }
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise(resolve => server.close(resolve));
  return port;
}

async function waitForPort(port, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const connected = await new Promise(resolve => {
      const socket = net.createConnection({ host: '127.0.0.1', port });
      socket.once('connect', () => { socket.destroy(); resolve(true); });
      socket.once('error', () => resolve(false));
    });
    if (connected) return;
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`PostgreSQL did not start on port ${port}`);
}

async function waitForReady(url, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`API did not become ready at ${url}`);
}

async function terminate(child, signal = 'SIGTERM') {
  if (!child || child.exitCode !== null) return;
  child.kill(signal);
  await Promise.race([
    new Promise(resolve => child.once('exit', resolve)),
    new Promise(resolve => setTimeout(resolve, 3_000)),
  ]);
  if (child.exitCode === null) child.kill('SIGKILL');
}

async function prepareDatabase() {
  if (process.env.TEST_DATABASE_URL) {
    externalSchema = `e2e_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const url = new URL(process.env.TEST_DATABASE_URL);
    url.searchParams.set('schema', externalSchema);
    databaseUrl = url.toString();
    stage(`using isolated schema ${externalSchema}`);
    return;
  }

  for (const command of ['initdb', 'postgres', 'createdb']) {
    if (!commandExists(command)) {
      throw new Error(`Missing ${command}. Install PostgreSQL or provide TEST_DATABASE_URL.`);
    }
  }
  temporaryDatabaseDirectory = mkdtempSync(path.join(os.tmpdir(), 'bai-prod-e2e-pg-'));
  run('initdb', ['-D', temporaryDatabaseDirectory, '--no-locale', '--encoding=UTF8', '--auth=trust']);
  const port = await freePort();
  postgresProcess = spawn('postgres', ['-D', temporaryDatabaseDirectory, '-p', String(port)], {
    cwd: root, stdio: ['ignore', 'ignore', 'pipe'],
  });
  await waitForPort(port);
  run('createdb', ['-h', '127.0.0.1', '-p', String(port), 'bai_prod_e2e']);
  const username = encodeURIComponent(os.userInfo().username);
  databaseUrl = `postgresql://${username}@127.0.0.1:${port}/bai_prod_e2e?schema=public`;
  stage('started temporary PostgreSQL');
}

function signInitData(id, username) {
  const params = new URLSearchParams({
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `e2e-${id}`,
    user: JSON.stringify({ id, first_name: username, username: username.toLowerCase(), language_code: 'ru' }),
  });
  const checkString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(checkString).digest('hex'));
  return params.toString();
}

async function main() {
  await prepareDatabase();
  const databaseEnv = { DATABASE_URL: databaseUrl };
  stage('applying committed migration');
  run('npm', ['run', 'db:deploy'], databaseEnv);
  stage('seeding product data');
  run('npm', ['run', 'db:seed'], databaseEnv);
  stage('building API');
  run('npm', ['run', 'build', '-w', '@bai/api'], databaseEnv);
  stage('building bot workflows');
  run('npm', ['run', 'build', '-w', '@bai/bot'], databaseEnv);

  const apiPort = await freePort();
  const baseUrl = `http://127.0.0.1:${apiPort}`;
  apiProcess = spawn('node', ['apps/api/dist/server.js'], {
    cwd: root,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      BOT_TOKEN: botToken,
      JWT_SECRET: jwtSecret,
      WEBAPP_URL: 'https://app.example.test',
      CORS_ORIGINS: 'http://127.0.0.1:5173',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? 'sk-test-not-a-real-openai-key-for-e2e',
      OPENAI_MODEL: process.env.OPENAI_MODEL ?? 'gpt-5-mini',
      AI_DAILY_LIMIT: '5',
      PORT: String(apiPort),
      LOG_LEVEL: 'silent',
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await waitForReady(`${baseUrl}/ready`);

  const request = async (route, options = {}) => {
    const response = await fetch(baseUrl + route, {
      ...options,
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    const body = response.status === 204 ? null : await response.json();
    if (!response.ok) throw new Error(`${route}: ${response.status} ${JSON.stringify(body)}`);
    return body;
  };
  const rawRequest = async (route, options = {}) => {
    const response = await fetch(baseUrl + route, {
      ...options,
      headers: {
        ...(options.body ? { 'content-type': 'application/json' } : {}),
        ...options.headers,
      },
    });
    return { status: response.status, body: response.status === 204 ? null : await response.json() };
  };

  const health = await request('/health');
  assert(health.ok, 'Health endpoint failed');

  const invalid = new URLSearchParams(signInitData(777000, 'Алан'));
  invalid.set('hash', '0'.repeat(64));
  const invalidResponse = await fetch(`${baseUrl}/auth/telegram`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ initData: invalid.toString() }),
  });
  assert(invalidResponse.status === 401, 'Tampered Telegram initData must return 401');

  const auth = await request('/auth/telegram', { method: 'POST', body: JSON.stringify({ initData: signInitData(777000, 'Алан') }) });
  const headers = { authorization: `Bearer ${auth.token}` };
  const before = await request('/bootstrap', { headers });
  assert(auth.status === 'approved', 'Seeded user must be approved');
  assert(before.courses.length === 3 && before.content.length === 6, 'Bootstrap content is incomplete');

  const task = await request('/tasks', { method: 'POST', headers, body: JSON.stringify({ title: 'API E2E task', type: 'small', date: new Date().toISOString() }) });
  const completedTask = await request(`/tasks/${task.id}`, { method: 'PATCH', headers, body: JSON.stringify({ isCompleted: true }) });
  const repeatedTask = await request(`/tasks/${task.id}`, { method: 'PATCH', headers, body: JSON.stringify({ isCompleted: true }) });
  assert(completedTask.xp === before.user.xp + 5, 'Task must award exactly 5 XP');
  assert(repeatedTask.xp === completedTask.xp, 'Task completion must be idempotent');

  const firstLesson = before.courses.find(course => course.access === 'free')?.lessons[0];
  assert(firstLesson, 'Free lesson is missing');
  const completedLesson = await request(`/academy/lessons/${firstLesson.id}`, { method: 'PATCH', headers, body: JSON.stringify({ isCompleted: true }) });
  assert(completedLesson.xp === completedTask.xp + firstLesson.xpReward, 'Lesson XP was not awarded');

  const sharedRequestId = crypto.randomUUID();
  const result = await request('/results', { method: 'POST', headers, body: JSON.stringify({ type: 'call', value: 1, note: 'API E2E', clientRequestId: sharedRequestId }) });
  assert(result.xpReward === 10, 'Result XP reward is incorrect');
  const activity = await request('/activity/today', { method: 'PUT', headers, body: JSON.stringify({ active: true }) });
  assert(activity.active, 'Activity day was not marked');

  const secondAuth = await request('/auth/telegram', { method: 'POST', body: JSON.stringify({ initData: signInitData(888000, 'Дана') }) });
  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await prisma.user.update({ where: { telegramId: 888000n }, data: { status: 'approved', location: 'Гонолулу', timeZone: 'Pacific/Honolulu', occupation: 'Маркетолог', goal: 'Найти партнёра' } });
  const secondHeaders = { authorization: `Bearer ${secondAuth.token}` };

  const secondBefore = await request('/bootstrap', { headers: secondHeaders });
  assert(secondBefore.tasks.every(item => item.userId === secondBefore.user.id), 'Second user bootstrap leaked another user task');
  const forbiddenTask = await rawRequest(`/tasks/${task.id}`, { method: 'PATCH', headers: secondHeaders, body: JSON.stringify({ isCompleted: false }) });
  const forbiddenResult = await rawRequest(`/results/${result.id}`, { method: 'DELETE', headers: secondHeaders });
  assert(forbiddenTask.status === 404 && forbiddenResult.status === 404, 'Cross-user mutation was not blocked');

  const secondLesson = await request(`/academy/lessons/${firstLesson.id}`, { method: 'PATCH', headers: secondHeaders, body: JSON.stringify({ isCompleted: true }) });
  assert(secondLesson.xp === secondBefore.user.xp + firstLesson.xpReward, 'Shared lesson XP must be awarded independently per user');
  const secondResult = await request('/results', { method: 'POST', headers: secondHeaders, body: JSON.stringify({ type: 'call', value: 1, note: 'Second user', clientRequestId: sharedRequestId }) });
  assert(secondResult.id !== result.id && secondResult.userId === secondBefore.user.id, 'Idempotency key leaked a result across users');

  const future = new Date(); future.setDate(future.getDate() + 7);
  const futureTask = await request('/tasks', { method: 'POST', headers, body: JSON.stringify({ title: 'Future API task', type: 'main', date: future.toISOString() }) });
  const planningBootstrap = await request('/bootstrap', { headers });
  assert(planningBootstrap.tasks.some(item => item.id === futureTask.id), 'All-task planning window omitted a future task');

  const extraSmallTasks = await Promise.all(Array.from({ length: 5 }, (_, index) => request('/tasks', { method: 'POST', headers: secondHeaders, body: JSON.stringify({ title: `Cap task ${index + 1}`, type: 'small', date: new Date().toISOString() }) })));
  assert(extraSmallTasks.filter(item => item.xpReward === 5).length === 5, 'First five small tasks must be eligible for XP');
  const overflowTask = await request('/tasks', { method: 'POST', headers: secondHeaders, body: JSON.stringify({ title: 'Overflow task', type: 'small', date: new Date().toISOString() }) });
  assert(overflowTask.xpReward === 0, 'Extra 1-3-5 tasks must remain allowed without XP');
  const members = await request('/members', { headers });
  const secondMember = members.find(member => member.username === 'дана');
  assert(secondAuth.status === 'pending' && secondMember, 'Approved networking member is missing');
  const connection = await request(`/members/${secondMember.id}/connect`, { method: 'POST', headers, body: JSON.stringify({ message: 'E2E hello' }) });
  assert(connection.match.status === 'pending', 'Networking request was not created');
  assert(connection.contactUrl === null, 'Contact must stay private before acceptance');
  const queuedRequest = await prisma.botNotification.findUnique({ where: { dedupeKey: `match-request:${connection.match.id}` } });
  assert(queuedRequest?.userId === secondMember.id, 'Private match request notification was not queued for the receiver');
  const { acceptMatch } = await import(path.join(root, 'apps/bot/dist/match-service.js'));
  const { planScheduledNotifications, runAutomationTick } = await import(path.join(root, 'apps/bot/dist/automation.js'));
  const forbiddenAccept = await acceptMatch(prisma, before.user.id, connection.match.id);
  assert(forbiddenAccept === null, 'Sender must not be able to accept their own request');
  const acceptedMatch = await acceptMatch(prisma, secondMember.id, connection.match.id);
  assert(acceptedMatch?.status === 'accepted', 'Receiver could not accept the match');
  const acceptanceDeliveries = await prisma.botNotification.count({ where: { payload: { path: ['matchId'], equals: connection.match.id }, type: { in: ['matchAccepted', 'matchContact'] } } });
  assert(acceptanceDeliveries === 4, 'Acceptance must queue confirmations and contacts for both users');
  const acceptedConnection = await request(`/members/${secondMember.id}/connect`, { method: 'POST', headers, body: JSON.stringify({ message: 'repeat' }) });
  assert(acceptedConnection.match.status === 'accepted' && acceptedConnection.contactUrl, 'Accepted match must expose the counterpart contact');
  const automationConfig = { webAppUrl: 'https://app.example.test', timeZone: 'Asia/Almaty', dailyPlanHour: 9, weeklyCuratorHour: 10, weeklyMatchHour: 12, streakRiskHour: 21, intervalMs: 60_000 };
  const mondayAfternoon = new Date('2026-08-24T08:00:00.000Z');
  await planScheduledNotifications(prisma, mondayAfternoon, automationConfig);
  await planScheduledNotifications(prisma, mondayAfternoon, automationConfig);
  const scheduledForMainUser = await prisma.botNotification.count({ where: { userId: before.user.id, type: { in: ['introLesson', 'dailyPlan', 'weeklyCurator', 'weeklyMatch'] } } });
  assert(scheduledForMainUser === 4, 'Scheduled notifications must be idempotent across repeated ticks');
  const secondWeeklyNotifications = await prisma.botNotification.count({ where: { userId: secondMember.id, type: { in: ['weeklyCurator', 'weeklyMatch'] } } });
  assert(secondWeeklyNotifications === 0, 'Monday notifications must respect each user timezone');
  const sentMessages = [];
  const fakeBot = { api: { sendMessage: async (chatId, text, options) => { sentMessages.push({ chatId: String(chatId), text, options }); return { message_id: sentMessages.length }; } } };
  await runAutomationTick(fakeBot, prisma, automationConfig, mondayAfternoon);
  await runAutomationTick(fakeBot, prisma, automationConfig, mondayAfternoon);
  const stableMessageCount = sentMessages.length;
  await runAutomationTick(fakeBot, prisma, automationConfig, mondayAfternoon);
  assert(sentMessages.length === stableMessageCount, 'A repeated automation tick duplicated delivered messages');
  const mainChatMessages = sentMessages.filter(message => message.chatId === '777000').map(message => message.text);
  assert(mainChatMessages.some(text => text.includes('Вводный урок')) && mainChatMessages.some(text => text.includes('Твой план на сегодня')) && mainChatMessages.some(text => text.includes('Неделя началась')), 'Main bot communication sequence was not delivered');
  assert(sentMessages.filter(message => message.text.includes('Вот контакт')).length >= 2, 'Accepted match contacts were not delivered to both users');

  const leaderboard = await request('/leaderboard?period=all', { headers });
  assert(Array.isArray(leaderboard.leaders) && leaderboard.me.position >= 1, 'Leaderboard response is invalid');
  await request('/profile', { method: 'PATCH', headers, body: JSON.stringify({ goal: 'Проверить production E2E' }) });
  const bookingAttempts = await Promise.all([
    rawRequest('/curator-bookings', { method: 'POST', headers, body: JSON.stringify({ note: 'E2E booking A' }) }),
    rawRequest('/curator-bookings', { method: 'POST', headers, body: JSON.stringify({ note: 'E2E booking B' }) }),
  ]);
  assert(bookingAttempts.filter(item => item.status === 200).length === 1 && bookingAttempts.filter(item => item.status === 409).length === 1, 'Concurrent curator booking must create exactly one active request');

  let mentorAnswered = false;
  if (hasLiveOpenAI) {
    const mentor = await request('/mentor', { method: 'POST', headers, body: JSON.stringify({ question: 'Назови один конкретный шаг проверки оффера сегодня.' }) });
    mentorAnswered = typeof mentor.answer === 'string' && mentor.answer.length > 20 && mentor.remaining === 4;
    assert(mentorAnswered, 'OpenAI mentor did not return a valid answer');
  } else if (process.env.E2E_REQUIRE_OPENAI === '1') {
    throw new Error('E2E_REQUIRE_OPENAI=1 but OPENAI_API_KEY is unavailable');
  }

  await request(`/results/${result.id}`, { method: 'DELETE', headers });
  await request(`/tasks/${task.id}`, { method: 'DELETE', headers });
  await request(`/tasks/${futureTask.id}`, { method: 'DELETE', headers });
  await request(`/academy/lessons/${firstLesson.id}`, { method: 'PATCH', headers, body: JSON.stringify({ isCompleted: false }) });
  await request(`/results/${secondResult.id}`, { method: 'DELETE', headers: secondHeaders });
  await request(`/academy/lessons/${firstLesson.id}`, { method: 'PATCH', headers: secondHeaders, body: JSON.stringify({ isCompleted: false }) });
  for (const item of [...extraSmallTasks, overflowTask]) await request(`/tasks/${item.id}`, { method: 'DELETE', headers: secondHeaders });
  await request('/activity/today', { method: 'PUT', headers, body: JSON.stringify({ active: false }) });
  const after = await request('/bootstrap', { headers });
  assert(after.user.xp === before.user.xp, 'Cleanup must restore the initial XP balance');

  stage(`passed: auth, multi-user isolation, idempotency, planning, task XP caps, academy, results, private match acceptance/outbox, scheduled bot delivery dedupe, leaderboard, booking race, cleanup${mentorAnswered ? ', OpenAI' : ' (OpenAI skipped)'}`);
}

async function cleanup() {
  await terminate(apiProcess);
  if (prisma) await prisma.$disconnect();
  if (externalSchema && databaseUrl) {
    const cleanupClient = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    try { await cleanupClient.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${externalSchema}" CASCADE`); }
    finally { await cleanupClient.$disconnect(); }
  }
  await terminate(postgresProcess, 'SIGINT');
  if (temporaryDatabaseDirectory) rmSync(temporaryDatabaseDirectory, { recursive: true, force: true });
}

try {
  await main();
} finally {
  await cleanup();
}
