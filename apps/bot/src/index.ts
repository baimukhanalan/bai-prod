import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { Bot, GrammyError, Keyboard, InlineKeyboard } from 'grammy';
import type { User as TelegramUser } from 'grammy/types';
import { Prisma, PrismaClient } from '@prisma/client';
import OpenAI from 'openai';
import { z } from 'zod';
import { enqueueAccepted, enqueueIntro, startAutomation } from './automation.js';
import { bareBaiInvocationReply, GroupConversationResponder, isAutomatedGroupSender, isBaiInvocation, isContextualContinuation, shouldHandleGroupText } from './group-chat.js';
import { pairKey, parseTags } from './matching.js';
import { acceptMatch, declineMatch } from './match-service.js';
import { nextOnboardingStep, onboardingPrompts } from './onboarding.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const vercelEnvPath = path.join(repoRoot, '.vercel', 'neon.env');
if (fs.existsSync(vercelEnvPath)) {
  const managedDatabaseUrl = dotenv.parse(fs.readFileSync(vercelEnvPath)).DATABASE_URL;
  if (managedDatabaseUrl) process.env.DATABASE_URL = managedDatabaseUrl;
}
dotenv.config({ path: [path.join(repoRoot, '.env.local'), path.join(repoRoot, '.env')], quiet: true });

const env = z.object({
  BOT_TOKEN: z.string().min(20),
  WEBAPP_URL: z.string().url(),
  ADMIN_CHAT_ID: z.string().optional(),
  AUTO_APPROVE_USERS: z.string().default('false').transform(value => value === 'true'),
  INTRO_LESSON_URL: z.preprocess(value => value === '' ? undefined : value, z.string().url().optional()),
  CLOSED_CHANNEL_URL: z.preprocess(value => value === '' ? undefined : value, z.string().url().optional()),
  CURATOR_URL: z.preprocess(value => value === '' ? undefined : value, z.string().url().optional()),
  BOT_TIME_ZONE: z.string().default('Asia/Almaty'),
  DAILY_PLAN_HOUR: z.coerce.number().int().min(0).max(23).default(9),
  WEEKLY_CURATOR_HOUR: z.coerce.number().int().min(0).max(23).default(10),
  WEEKLY_MATCH_HOUR: z.coerce.number().int().min(0).max(23).default(12),
  STREAK_RISK_HOUR: z.coerce.number().int().min(0).max(23).default(21),
  BOT_SCHEDULER_INTERVAL_MS: z.coerce.number().int().min(10_000).max(3_600_000).default(60_000),
  BOT_SCHEDULER_TICK_TIMEOUT_MS: z.coerce.number().int().min(30_000).max(600_000).default(180_000),
  BOT_DELIVERY_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(120_000).default(45_000),
  OPENAI_API_KEY: z.string().min(20).optional(),
  OPENAI_MODEL: z.string().default('gpt-5-mini'),
  GROUP_AI_ENABLED: z.string().default('false').transform(value => value === 'true'),
  GROUP_AI_MODE: z.enum(['all', 'mentions', 'contextual']).default('contextual'),
  GROUP_AI_CHAT_ALLOWLIST: z.string().optional(),
  GROUP_AI_MIN_INTERVAL_MS: z.coerce.number().int().min(1_000).max(60_000).default(3_500),
  GROUP_AI_DAILY_LIMIT_PER_CHAT: z.coerce.number().int().min(1).max(2_000).default(300),
  GROUP_AI_MAX_CONTEXT_MESSAGES: z.coerce.number().int().min(0).max(30).default(10),
}).parse(process.env);

const prisma = new PrismaClient();
const bot = new Bot(env.BOT_TOKEN, { client: { timeoutSeconds: Math.ceil(env.BOT_DELIVERY_TIMEOUT_MS / 1_000) } });
const openai = env.GROUP_AI_ENABLED && env.OPENAI_API_KEY ? new OpenAI({ apiKey: env.OPENAI_API_KEY }) : null;
const allowedGroupChats = new Set(env.GROUP_AI_CHAT_ALLOWLIST?.split(',').map(value => value.trim()).filter(Boolean) ?? []);
const groupResponder = openai ? new GroupConversationResponder({
  dailyLimitPerChat: env.GROUP_AI_DAILY_LIMIT_PER_CHAT,
  maxContextMessages: env.GROUP_AI_MAX_CONTEXT_MESSAGES,
}, async request => {
  const response = await openai.responses.create({
    model: env.OPENAI_MODEL,
    reasoning: env.OPENAI_MODEL.startsWith('gpt-5') ? { effort: 'low' } : undefined,
    instructions: request.instructions,
    input: request.input,
    max_output_tokens: Math.min(request.maxOutputTokens, 120),
  });
  return response.output_text;
}) : null;
const groupQueues = new Map<string, Promise<void>>();
const lastGroupReplyAt = new Map<string, number>();
const activeGroupConversations = new Map<string, { senderId: string; repliedAt: number; sourceMessageId: number }>();

function phoneKeyboard() {
  return new Keyboard().requestContact('📱 Поделиться телефоном').text('Пропустить').resized().oneTime();
}

function appKeyboard() {
  return new InlineKeyboard().webApp('Открыть BAI.PROD', env.WEBAPP_URL);
}

function isAdmin(id?: number) {
  return Boolean(id && env.ADMIN_CHAT_ID && String(id) === env.ADMIN_CHAT_ID);
}

async function ensureUser(from: TelegramUser) {
  return prisma.user.upsert({
    where: { telegramId: BigInt(from.id) },
    update: { username: from.username, name: from.first_name },
    create: { telegramId: BigInt(from.id), username: from.username, name: from.first_name, timeZone: env.BOT_TIME_ZONE },
  });
}

bot.command('start', async ctx => {
  if (!ctx.from) return;
  const user = await ensureUser(ctx.from);
  await prisma.onboardingSession.upsert({
    where: { userId: user.id },
    update: { step: 'name', data: {} },
    create: { userId: user.id, step: 'name', data: {} },
  });
  await ctx.reply('Добро пожаловать в BAI.PROD — среду для роста, дисциплины и сильных связей.\n\nЗаполним короткую анкету, это займёт около двух минут.');
  await ctx.reply(onboardingPrompts.name, { reply_markup: { remove_keyboard: true } });
});

bot.command('cancel', async ctx => {
  if (!ctx.from) return;
  const user = await ensureUser(ctx.from);
  await prisma.onboardingSession.deleteMany({ where: { userId: user.id } });
  await ctx.reply('Анкета остановлена. Чтобы начать заново, отправь /start.', { reply_markup: { remove_keyboard: true } });
});

bot.command('app', async ctx => {
  if (!ctx.from) return;
  const user = await ensureUser(ctx.from);
  const session = await prisma.onboardingSession.findUnique({ where: { userId: user.id } });
  if (session?.step !== 'completed') return void ctx.reply('Сначала заверши короткую анкету: /start');
  await ctx.reply('Твоя экосистема BAI.PROD:', { reply_markup: appKeyboard() });
});

bot.command('lesson', async ctx => {
  if (!ctx.from) return;
  const user = await ensureUser(ctx.from);
  if (user.status !== 'approved') return void ctx.reply('Вводный урок откроется после одобрения анкеты.');
  const dateKey = new Date().toISOString().slice(0, 10);
  await prisma.botNotification.createMany({ data: [{ userId: user.id, type: 'introLesson', dedupeKey: `intro-lesson-manual:${dateKey}:${user.id}`, payload: {} }], skipDuplicates: true });
  await ctx.reply('Отправляю вводный урок 👇');
});

bot.command('timezone', async ctx => {
  if (!ctx.from) return;
  const user = await ensureUser(ctx.from);
  const timeZone = ctx.match.trim();
  if (!timeZone) return void ctx.reply(`Текущий часовой пояс: ${user.timeZone}\n\nЧтобы изменить: /timezone Europe/Moscow`);
  try { new Intl.DateTimeFormat('ru-RU', { timeZone }).format(new Date()); }
  catch { return void ctx.reply('Неизвестный часовой пояс. Используй формат IANA, например Europe/Moscow или Asia/Almaty.'); }
  await prisma.user.update({ where: { id: user.id }, data: { timeZone } });
  await ctx.reply(`Готово. Напоминания будут приходить по времени ${timeZone}.`);
});

bot.command('approve', async ctx => {
  if (!isAdmin(ctx.from?.id)) return;
  const telegramId = ctx.match.trim();
  if (!/^\d+$/.test(telegramId)) return void ctx.reply('Формат: /approve TELEGRAM_ID');
  const user = await prisma.user.update({ where: { telegramId: BigInt(telegramId) }, data: { status: 'approved' } }).catch(() => null);
  if (!user) return void ctx.reply('Пользователь не найден.');
  await ctx.reply(`✅ ${user.name ?? user.username ?? user.id} одобрен.`);
  await bot.api.sendMessage(user.telegramId.toString(), 'Твоя анкета одобрена — добро пожаловать в BAI.PROD!', { reply_markup: appKeyboard() });
  await enqueueIntro(prisma, user.id);
});

bot.callbackQuery(/^approve:(.+)$/, async ctx => {
  if (!isAdmin(ctx.from.id)) return void ctx.answerCallbackQuery({ text: 'Недостаточно прав', show_alert: true });
  const userId = ctx.match[1];
  const user = await prisma.user.update({ where: { id: userId }, data: { status: 'approved' } }).catch(() => null);
  if (!user) return void ctx.answerCallbackQuery({ text: 'Пользователь не найден', show_alert: true });
  await ctx.answerCallbackQuery({ text: 'Участник одобрен' });
  await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().text('✅ Одобрен', 'noop') });
  await bot.api.sendMessage(user.telegramId.toString(), 'Твоя анкета одобрена — добро пожаловать в BAI.PROD!', { reply_markup: appKeyboard() });
  await enqueueIntro(prisma, user.id);
});

bot.callbackQuery('noop', ctx => ctx.answerCallbackQuery());

bot.callbackQuery(/^match:(accept|decline):(.+)$/, async ctx => {
  const user = await ensureUser(ctx.from);
  const action = ctx.match[1];
  const matchId = ctx.match[2]!;
  if (action === 'decline') {
    const changed = await declineMatch(prisma, user.id, matchId);
    await ctx.answerCallbackQuery({ text: changed ? 'Заявка отклонена' : 'Заявка уже обработана' });
    if (changed) await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().text('Не сейчас', 'noop') });
    return;
  }
  const accepted = await acceptMatch(prisma, user.id, matchId);
  await ctx.answerCallbackQuery({ text: accepted ? 'Знакомство открыто' : 'Заявка уже обработана' });
  if (accepted) await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().text('✅ Принято', 'noop') });
});

bot.callbackQuery(/^weekly:connect:(.+)$/, async ctx => {
  const sender = await ensureUser(ctx.from);
  const receiverId = ctx.match[1]!;
  if (sender.id === receiverId || sender.status !== 'approved') return void ctx.answerCallbackQuery({ text: 'Знакомство недоступно', show_alert: true });
  const receiver = await prisma.user.findFirst({ where: { id: receiverId, status: 'approved', isDiscoverable: true } });
  if (!receiver) return void ctx.answerCallbackQuery({ text: 'Участник сейчас недоступен', show_alert: true });
  const result = await prisma.$transaction(async tx => {
    const key = pairKey(sender.id, receiver.id);
    const existing = await tx.matchRequest.findUnique({ where: { pairKey: key } });
    if (existing?.status === 'accepted') return 'accepted' as const;
    if (existing?.status === 'pending' && existing.receiverId === sender.id) {
      const accepted = await tx.matchRequest.update({ where: { id: existing.id }, data: { status: 'accepted' } });
      await enqueueAccepted(tx, accepted);
      return 'mutual' as const;
    }
    if (existing?.status === 'pending') return 'pending' as const;
    const match = existing
      ? await tx.matchRequest.update({ where: { id: existing.id }, data: { senderId: sender.id, receiverId: receiver.id, status: 'pending', message: 'Знакомство недели' } })
      : await tx.matchRequest.create({ data: { senderId: sender.id, receiverId: receiver.id, pairKey: key, message: 'Знакомство недели' } });
    await tx.botNotification.upsert({
      where: { dedupeKey: `match-request:${match.id}` },
      update: { userId: receiver.id, payload: { matchId: match.id }, scheduledFor: new Date(), claimedAt: null, sentAt: null, attempts: 0, lastError: null },
      create: { userId: receiver.id, type: 'matchRequest', dedupeKey: `match-request:${match.id}`, payload: { matchId: match.id } },
    });
    return 'created' as const;
  });
  const text = result === 'created' ? 'Заявка отправлена 🙌' : result === 'mutual' ? 'Это взаимно — знакомство открыто!' : result === 'accepted' ? 'Вы уже знакомы' : 'Заявка уже ожидает ответа';
  await ctx.answerCallbackQuery({ text, show_alert: result === 'mutual' });
  if (result === 'created' || result === 'pending') await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard().text('⏳ Заявка отправлена', 'noop') });
});

bot.chatType(['group', 'supergroup']).on('message:text', async ctx => {
  const automatedSender = isAutomatedGroupSender(ctx.from.is_bot, Boolean(ctx.message.sender_chat), ctx.from.id === ctx.me.id);
  if (!groupResponder || !shouldHandleGroupText(ctx.message.text, automatedSender)) return;
  const chatId = String(ctx.chat.id);
  if (allowedGroupChats.size && !allowedGroupChats.has(chatId)) return;
  const senderId = String(ctx.message.sender_chat?.id ?? ctx.from.id);
  const isNamed = isBaiInvocation(ctx.message.text);
  const isExplicitlyDirected = isNamed
    || ctx.message.text.toLocaleLowerCase('ru-RU').includes(`@${ctx.me.username.toLocaleLowerCase('ru-RU')}`)
    || ctx.message.reply_to_message?.from?.id === ctx.me.id;
  const activeConversation = activeGroupConversations.get(chatId);
  const isContinuation = Boolean(activeConversation && isContextualContinuation({
    sameSender: activeConversation.senderId === senderId,
    elapsedMs: Date.now() - activeConversation.repliedAt,
    messageGap: ctx.message.message_id - activeConversation.sourceMessageId,
  }));
  const isDirected = isExplicitlyDirected || (env.GROUP_AI_MODE === 'contextual' && isContinuation);
  if (env.GROUP_AI_MODE !== 'all' && !isDirected) return;

  const instantReply = isNamed ? bareBaiInvocationReply(ctx.message.text, ctx.message.message_id) : null;
  if (instantReply) {
    await ctx.reply(instantReply, { reply_parameters: { message_id: ctx.message.message_id, allow_sending_without_reply: true } });
    lastGroupReplyAt.set(chatId, Date.now());
    activeGroupConversations.set(chatId, { senderId, repliedAt: Date.now(), sourceMessageId: ctx.message.message_id });
    return;
  }

  if (isDirected) console.info('Direct BAI group invocation received', { chatId, messageId: ctx.message.message_id });
  const previous = isDirected ? Promise.resolve() : (groupQueues.get(chatId) ?? Promise.resolve());
  const queued = previous.catch(() => undefined).then(async () => {
    const waitMs = isDirected ? 0 : Math.max(0, env.GROUP_AI_MIN_INTERVAL_MS - (Date.now() - (lastGroupReplyAt.get(chatId) ?? 0)));
    if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
    await ctx.api.sendChatAction(ctx.chat.id, 'typing').catch(() => undefined);
    const reply = await groupResponder.reply({
      chatId,
      chatTitle: ctx.chat.title,
      messageId: ctx.message.message_id,
      senderId,
      senderName: ctx.message.sender_chat?.title ?? [ctx.from.first_name, ctx.from.last_name].filter(Boolean).join(' '),
      username: ctx.message.sender_chat?.username ?? ctx.from.username,
      text: ctx.message.text,
      replyToText: ctx.message.reply_to_message && 'text' in ctx.message.reply_to_message ? ctx.message.reply_to_message.text : undefined,
    });
    if (!reply) return;
    await ctx.reply(reply, { reply_parameters: { message_id: ctx.message.message_id, allow_sending_without_reply: true } });
    lastGroupReplyAt.set(chatId, Date.now());
    activeGroupConversations.set(chatId, { senderId, repliedAt: Date.now(), sourceMessageId: ctx.message.message_id });
  }).catch(error => console.error('Group AI reply failed', error));
  groupQueues.set(chatId, queued);
  void queued.finally(() => { if (groupQueues.get(chatId) === queued) groupQueues.delete(chatId); });
});

bot.on('channel_post:text', async ctx => {
  if (!groupResponder || !shouldHandleGroupText(ctx.channelPost.text, Boolean(ctx.channelPost.from?.is_bot)) || !isBaiInvocation(ctx.channelPost.text)) return;
  const chatId = String(ctx.chat.id);
  if (allowedGroupChats.size && !allowedGroupChats.has(chatId)) return;
  const instantReply = bareBaiInvocationReply(ctx.channelPost.text, ctx.channelPost.message_id);
  if (instantReply) {
    await ctx.api.sendMessage(ctx.chat.id, instantReply);
    return;
  }
  const reply = await groupResponder.reply({
    chatId,
    chatTitle: ctx.chat.title,
    messageId: ctx.channelPost.message_id,
    senderId: chatId,
    senderName: ctx.chat.title,
    text: ctx.channelPost.text,
  });
  if (reply) await ctx.api.sendMessage(ctx.chat.id, reply);
});

bot.chatType('private').on(['message:text', 'message:contact'], async ctx => {
  if (!ctx.from) return;
  const user = await ensureUser(ctx.from);
  const session = await prisma.onboardingSession.findUnique({ where: { userId: user.id } });
  if (!session || session.step === 'completed') return;

  const text = ctx.message.text?.trim();
  const contact = ctx.message.contact;
  const data = (session.data ?? {}) as Record<string, string | number | string[] | null>;
  let value: string | number | string[] | null;

  if (session.step === 'phone') {
    if (contact && contact.user_id !== ctx.from.id) return void ctx.reply('Пожалуйста, отправь свой контакт.');
    value = contact?.phone_number ?? (text === 'Пропустить' ? null : text ?? null);
    if (value && !/^\+?[\d\s()-]{7,24}$/.test(String(value))) return void ctx.reply('Отправь номер кнопкой, введи корректный номер или нажми «Пропустить».');
  } else if (session.step === 'age') {
    const age = Number(text);
    if (!Number.isInteger(age) || age < 14 || age > 100) return void ctx.reply('Укажи возраст числом от 14 до 100.');
    value = age;
  } else if (session.step === 'give' || session.step === 'seek') {
    const tags = parseTags(text ?? '');
    if (!tags.length) return void ctx.reply('Укажи хотя бы один пункт — можно перечислить несколько через запятую.');
    value = tags;
  } else {
    if (!text || text.length < 2) return void ctx.reply('Напиши ответ текстом — минимум 2 символа.');
    value = text;
  }

  data[session.step] = value;
  const following = nextOnboardingStep[session.step];
  await prisma.onboardingSession.update({ where: { userId: user.id }, data: { step: following, data: data as Prisma.InputJsonValue } });

  if (following !== 'completed') {
    await ctx.reply(onboardingPrompts[following], following === 'phone' ? { reply_markup: phoneKeyboard() } : { reply_markup: { remove_keyboard: true } });
    return;
  }

  const completed = await prisma.user.update({
    where: { id: user.id },
    data: {
      name: String(data.name), phone: data.phone ? String(data.phone) : null, age: Number(data.age),
      location: String(data.location), occupation: String(data.occupation), income: String(data.income),
      goal: String(data.goal), status: env.AUTO_APPROVE_USERS ? 'approved' : 'pending',
      giveTags: Array.isArray(data.give) ? data.give.map(String) : [],
      seekTags: Array.isArray(data.seek) ? data.seek.map(String) : [],
    },
  });
  await ctx.reply('Готово! Анкета сохранена. Открывай приложение — твой маршрут уже ждёт.', {
    reply_markup: appKeyboard(),
  });
  if (completed.status === 'approved') await enqueueIntro(prisma, completed.id);
  if (env.ADMIN_CHAT_ID) {
    await bot.api.sendMessage(env.ADMIN_CHAT_ID, `Новая анкета\n${completed.name ?? 'Без имени'} · @${completed.username ?? '—'}\nTelegram ID: ${completed.telegramId}\n${completed.location ?? '—'} · ${completed.occupation ?? '—'}\nЦель: ${completed.goal ?? '—'}`, { reply_markup: new InlineKeyboard().text('Одобрить', `approve:${completed.id}`) });
  }
});

bot.catch(error => console.error('Bot update failed', error.error));

const stopAutomation = startAutomation(bot, prisma, {
  webAppUrl: env.WEBAPP_URL,
  introLessonUrl: env.INTRO_LESSON_URL,
  closedChannelUrl: env.CLOSED_CHANNEL_URL,
  curatorUrl: env.CURATOR_URL,
  timeZone: env.BOT_TIME_ZONE,
  dailyPlanHour: env.DAILY_PLAN_HOUR,
  weeklyCuratorHour: env.WEEKLY_CURATOR_HOUR,
  weeklyMatchHour: env.WEEKLY_MATCH_HOUR,
  streakRiskHour: env.STREAK_RISK_HOUR,
  intervalMs: env.BOT_SCHEDULER_INTERVAL_MS,
  tickTimeoutMs: env.BOT_SCHEDULER_TICK_TIMEOUT_MS,
  deliveryTimeoutMs: env.BOT_DELIVERY_TIMEOUT_MS,
});
process.once('SIGINT', () => { stopAutomation(); bot.stop(); });
process.once('SIGTERM', () => { stopAutomation(); bot.stop(); });
await bot.api.setMyCommands([
  { command: 'start', description: 'Заполнить или обновить анкету' },
  { command: 'app', description: 'Открыть BAI.PROD' },
  { command: 'lesson', description: 'Получить вводный AI-урок' },
  { command: 'timezone', description: 'Настроить время напоминаний' },
  { command: 'cancel', description: 'Остановить заполнение анкеты' },
]);
await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'BAI.PROD', web_app: { url: env.WEBAPP_URL } } });
for (let attempt = 1; attempt <= 12; attempt += 1) {
  try {
    await bot.start({ onStart: info => console.log(`@${info.username} is running`) });
    break;
  } catch (error) {
    const rollingDeployConflict = error instanceof GrammyError && error.error_code === 409;
    if (!rollingDeployConflict || attempt === 12) throw error;
    const retryInMs = Math.min(3_000 * attempt, 15_000);
    console.warn('Telegram polling handover in progress; retrying', { attempt, retryInMs });
    await new Promise(resolve => setTimeout(resolve, retryInMs));
  }
}
