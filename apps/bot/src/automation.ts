import { Bot, InlineKeyboard } from 'grammy';
import { AbortController, type AbortSignal } from 'abort-controller';
import { BotNotificationType, Prisma, PrismaClient } from '@prisma/client';
import { chooseCandidate } from './matching.js';
import {
  dailyPlanText, introLessonText, matchAcceptedText, matchContactText, matchRequestText,
  streakRiskText, weeklyCuratorText, weeklyMatchText,
} from './messages.js';

export type AutomationConfig = {
  webAppUrl: string;
  introLessonUrl?: string;
  closedChannelUrl?: string;
  curatorUrl?: string;
  timeZone: string;
  dailyPlanHour: number;
  weeklyCuratorHour: number;
  weeklyMatchHour: number;
  streakRiskHour: number;
  intervalMs: number;
  deliveryTimeoutMs?: number;
  tickTimeoutMs?: number;
  heartbeatMs?: number;
};

const DEFAULT_DELIVERY_TIMEOUT_MS = 45_000;
const DEFAULT_TICK_TIMEOUT_MS = 180_000;
const DEFAULT_HEARTBEAT_MS = 15 * 60_000;

type Transaction = Prisma.TransactionClient;

function localParts(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
  return { dateKey: `${value('year')}-${value('month')}-${value('day')}`, weekday: value('weekday'), hour: Number(value('hour')) };
}

export async function enqueueIntro(prisma: PrismaClient | Transaction, userId: string) {
  await prisma.botNotification.createMany({
    data: [{ userId, type: 'introLesson', dedupeKey: `intro-lesson:${userId}`, payload: {} }],
    skipDuplicates: true,
  });
}

export async function enqueueAccepted(prisma: Transaction, match: { id: string; senderId: string; receiverId: string }) {
  await prisma.botNotification.createMany({
    data: [
      { userId: match.receiverId, type: 'matchAccepted', dedupeKey: `match-accepted:${match.id}:${match.receiverId}`, payload: { matchId: match.id } },
      { userId: match.senderId, type: 'matchAccepted', dedupeKey: `match-accepted:${match.id}:${match.senderId}`, payload: { matchId: match.id } },
      { userId: match.receiverId, type: 'matchContact', dedupeKey: `match-contact:${match.id}:${match.receiverId}`, payload: { matchId: match.id } },
      { userId: match.senderId, type: 'matchContact', dedupeKey: `match-contact:${match.id}:${match.senderId}`, payload: { matchId: match.id } },
    ],
    skipDuplicates: true,
  });
}

export async function planScheduledNotifications(prisma: PrismaClient, now: Date, config: AutomationConfig) {
  const users = await prisma.user.findMany({ where: { status: 'approved' }, select: { id: true, timeZone: true } });
  const notifications: Prisma.BotNotificationCreateManyInput[] = [];
  for (const user of users) {
    const local = localParts(now, user.timeZone || config.timeZone);
    notifications.push({ userId: user.id, type: 'introLesson', dedupeKey: `intro-lesson:${user.id}`, payload: {} });
    if (local.hour >= config.dailyPlanHour) notifications.push({ userId: user.id, type: 'dailyPlan', dedupeKey: `daily-plan:${local.dateKey}:${user.id}`, payload: { dateKey: local.dateKey } });
    if (local.weekday === 'Mon' && local.hour >= config.weeklyCuratorHour) notifications.push({ userId: user.id, type: 'weeklyCurator', dedupeKey: `weekly-curator:${local.dateKey}:${user.id}`, payload: {} });
    if (local.weekday === 'Mon' && local.hour >= config.weeklyMatchHour) notifications.push({ userId: user.id, type: 'weeklyMatch', dedupeKey: `weekly-match:${local.dateKey}:${user.id}`, payload: {} });
    if (local.hour >= config.streakRiskHour) notifications.push({ userId: user.id, type: 'streakRisk', dedupeKey: `streak-risk:${local.dateKey}:${user.id}`, payload: { dateKey: local.dateKey } });
  }
  if (notifications.length) await prisma.botNotification.createMany({ data: notifications, skipDuplicates: true });
}

async function claimNext(prisma: PrismaClient) {
  const claimed = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    WITH candidate AS (
      SELECT "id" FROM "bot_notifications"
      WHERE "sent_at" IS NULL
        AND "scheduled_for" <= NOW()
        AND "attempts" < 8
        AND ("claimed_at" IS NULL OR "claimed_at" < NOW() - INTERVAL '5 minutes')
      ORDER BY "scheduled_for" ASC, "created_at" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "bot_notifications"
    SET "claimed_at" = NOW(), "attempts" = "attempts" + 1
    WHERE "id" = (SELECT "id" FROM candidate)
    RETURNING "id"
  `);
  if (!claimed[0]) return null;
  return prisma.botNotification.findUnique({ where: { id: claimed[0].id }, include: { user: true } });
}

async function weeklyCandidate(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const existing = await prisma.matchRequest.findMany({ where: { OR: [{ senderId: userId }, { receiverId: userId }] }, select: { senderId: true, receiverId: true } });
  const excluded = new Set([userId, ...existing.flatMap(match => [match.senderId, match.receiverId])]);
  const candidates = await prisma.user.findMany({
    where: { status: 'approved', isDiscoverable: true, id: { notIn: [...excluded] } },
    orderBy: { updatedAt: 'desc' }, take: 50,
  });
  return chooseCandidate(user, candidates);
}

async function deliver(bot: Bot, prisma: PrismaClient, notification: NonNullable<Awaited<ReturnType<typeof claimNext>>>, config: AutomationConfig, signal: AbortSignal) {
  const chatId = notification.user.telegramId.toString();
  const payload = notification.payload as Record<string, unknown>;
  if (notification.type === BotNotificationType.introLesson) {
    const keyboard = new InlineKeyboard();
    if (config.introLessonUrl) keyboard.url('🎬 Смотреть вводный урок', config.introLessonUrl).row();
    if (config.closedChannelUrl) keyboard.url('🔒 Вступить в закрытый канал', config.closedChannelUrl).row();
    keyboard.webApp('Открыть BAI.PROD', config.webAppUrl);
    await bot.api.sendMessage(chatId, introLessonText, { parse_mode: 'HTML', reply_markup: keyboard }, signal);
    return;
  }
  if (notification.type === BotNotificationType.dailyPlan) {
    const dateKey = String(payload.dateKey ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('Invalid daily-plan date');
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS "count" FROM "tasks"
      WHERE "user_id" = ${notification.userId}
        AND "date" = CAST(${dateKey} AS date)
        AND "is_completed" = false
    `);
    const count = Number(rows[0]?.count ?? 0n);
    await bot.api.sendMessage(chatId, dailyPlanText(count), { parse_mode: 'HTML', reply_markup: new InlineKeyboard().webApp('✅ Дисциплина', config.webAppUrl) }, signal);
    return;
  }
  if (notification.type === BotNotificationType.weeklyCurator) {
    const keyboard = config.curatorUrl ? new InlineKeyboard().url('Написать куратору · Разбор', config.curatorUrl) : new InlineKeyboard().webApp('Открыть профиль', config.webAppUrl);
    await bot.api.sendMessage(chatId, weeklyCuratorText, { parse_mode: 'HTML', reply_markup: keyboard }, signal);
    return;
  }
  if (notification.type === BotNotificationType.weeklyMatch) {
    const candidate = await weeklyCandidate(prisma, notification.userId);
    if (!candidate) return;
    await bot.api.sendMessage(chatId, weeklyMatchText(candidate), { parse_mode: 'HTML', reply_markup: new InlineKeyboard().text('🤝 Хочу познакомиться', `weekly:connect:${candidate.id}`) }, signal);
    return;
  }
  if (notification.type === BotNotificationType.streakRisk) {
    const dateKey = String(payload.dateKey ?? '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error('Invalid streak-risk date');
    if (notification.user.streakDays <= 0) return;
    const active = await prisma.$queryRaw<Array<{ active: boolean }>>(Prisma.sql`
      SELECT EXISTS(
        SELECT 1 FROM "activity_days"
        WHERE "user_id" = ${notification.userId}
          AND "date" = CAST(${dateKey} AS date)
          AND "score" > 0
      ) AS "active"
    `);
    if (active[0]?.active) return;
    await bot.api.sendMessage(chatId, streakRiskText(notification.user.streakDays), {
      parse_mode: 'HTML',
      reply_markup: new InlineKeyboard().webApp('✅ Отметить действие', config.webAppUrl),
    }, signal);
    return;
  }

  const matchId = String(payload.matchId ?? '');
  const match = await prisma.matchRequest.findUnique({ where: { id: matchId }, include: { sender: true, receiver: true } });
  if (!match) return;
  if (notification.type === BotNotificationType.matchRequest) {
    if (match.status !== 'pending' || match.receiverId !== notification.userId) return;
    const keyboard = new InlineKeyboard().text('✅ Принять', `match:accept:${match.id}`).text('Не сейчас', `match:decline:${match.id}`);
    await bot.api.sendMessage(chatId, matchRequestText(match.sender), { parse_mode: 'HTML', reply_markup: keyboard }, signal);
    return;
  }
  if (match.status !== 'accepted') return;
  const isReceiver = match.receiverId === notification.userId;
  const other = isReceiver ? match.sender : match.receiver;
  if (notification.type === BotNotificationType.matchAccepted) {
    await bot.api.sendMessage(chatId, matchAcceptedText(other, isReceiver), { parse_mode: 'HTML' }, signal);
    return;
  }
  const url = other.username ? `https://t.me/${other.username}` : `tg://user?id=${other.telegramId}`;
  await bot.api.sendMessage(chatId, matchContactText(other), { parse_mode: 'HTML', reply_markup: new InlineKeyboard().url('Открыть чат', url) }, signal);
}

async function withTimeout<T>(label: string, timeoutMs: number, task: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([task(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function runAutomationTick(bot: Bot, prisma: PrismaClient, config: AutomationConfig, now = new Date()) {
  await planScheduledNotifications(prisma, now, config);
  for (let index = 0; index < 50; index += 1) {
    const notification = await claimNext(prisma);
    if (!notification) break;
    try {
      await withTimeout('Bot notification delivery', config.deliveryTimeoutMs ?? DEFAULT_DELIVERY_TIMEOUT_MS, signal => deliver(bot, prisma, notification, config, signal));
      await prisma.botNotification.update({ where: { id: notification.id }, data: { sentAt: new Date(), claimedAt: null, lastError: null } });
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 1000) : 'Unknown delivery error';
      await prisma.botNotification.update({ where: { id: notification.id }, data: { claimedAt: null, lastError: message } });
    }
  }
}

type RecoveringLoopOptions = {
  intervalMs: number;
  timeoutMs: number;
  heartbeatMs: number;
  run: () => Promise<void>;
  log?: (message: string, details?: Record<string, unknown>) => void;
  logError?: (message: string, error: unknown) => void;
};

export function startRecoveringLoop(options: RecoveringLoopOptions) {
  let running = false;
  let lastHeartbeatAt = 0;
  const tick = async () => {
    if (running) return;
    running = true;
    const startedAt = Date.now();
    try {
      await withTimeout('Bot automation tick', options.timeoutMs, () => options.run());
      const now = Date.now();
      if (now - lastHeartbeatAt >= options.heartbeatMs) {
        lastHeartbeatAt = now;
        options.log?.('Bot automation heartbeat', { elapsedMs: now - startedAt });
      }
    }
    catch (error) { options.logError?.('Bot automation tick failed', error); }
    finally { running = false; }
  };
  void tick();
  const timer = setInterval(() => void tick(), options.intervalMs);
  return () => clearInterval(timer);
}

export function startAutomation(bot: Bot, prisma: PrismaClient, config: AutomationConfig) {
  const tickTimeoutMs = config.tickTimeoutMs ?? DEFAULT_TICK_TIMEOUT_MS;
  console.log('Bot automation scheduler started', {
    intervalMs: config.intervalMs,
    tickTimeoutMs,
    deliveryTimeoutMs: config.deliveryTimeoutMs ?? DEFAULT_DELIVERY_TIMEOUT_MS,
  });
  return startRecoveringLoop({
    intervalMs: config.intervalMs,
    timeoutMs: tickTimeoutMs,
    heartbeatMs: config.heartbeatMs ?? DEFAULT_HEARTBEAT_MS,
    run: () => runAutomationTick(bot, prisma, config),
    log: (message, details) => console.log(message, details),
    logError: (message, error) => console.error(message, error),
  });
}
