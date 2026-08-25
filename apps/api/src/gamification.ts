import type { Prisma, PrismaClient } from '@prisma/client';

type Transaction = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;

export const XP_REWARDS = {
  task: { main: 15, medium: 10, small: 5 },
  result: { income: 20, client: 30, call: 10, review: 15 },
} as const;

export function startOfDay(value = new Date()) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function levelForXp(xp: number) {
  if (xp >= 3500) return 'AI Pro';
  if (xp >= 1500) return 'Builder';
  if (xp >= 500) return 'AI Student';
  return 'Новичок';
}

export async function awardXp(tx: Transaction, userId: string, sourceKey: string, delta: number) {
  if (delta > 0) {
    const existing = await tx.xpEvent.findUnique({ where: { userId_sourceKey: { userId, sourceKey } } });
    if (existing) return tx.user.findUniqueOrThrow({ where: { id: userId } });
    await tx.xpEvent.create({ data: { userId, sourceKey, delta } });
  } else {
    const removed = await tx.xpEvent.deleteMany({ where: { sourceKey, userId } });
    if (removed.count === 0) return tx.user.findUniqueOrThrow({ where: { id: userId } });
  }
  const user = await tx.user.update({ where: { id: userId }, data: { xp: { increment: delta } } });
  const level = levelForXp(Math.max(0, user.xp));
  return level === user.level ? user : tx.user.update({ where: { id: userId }, data: { level } });
}

export async function recordActivity(tx: Transaction, userId: string, value = new Date()) {
  const today = startOfDay(value);
  await tx.activityDay.upsert({ where: { userId_date: { userId, date: today } }, update: { score: { increment: 1 } }, create: { userId, date: today } });
  return recomputeStreak(tx, userId, today);
}

export async function recomputeStreak(tx: Transaction, userId: string, value = new Date()) {
  const today = startOfDay(value);
  const days = await tx.activityDay.findMany({ where: { userId, date: { lte: today } }, orderBy: { date: 'desc' }, take: 370, select: { date: true } });
  const keys = new Set(days.map(day => startOfDay(day.date).getTime()));
  let cursor = today;
  let streak = 0;
  while (keys.has(cursor.getTime())) { streak += 1; cursor = new Date(cursor); cursor.setDate(cursor.getDate() - 1); }
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { bestStreak: true } });
  return tx.user.update({ where: { id: userId }, data: { lastActiveDate: today, streakDays: streak, bestStreak: Math.max(streak, user.bestStreak) } });
}

export async function monthlyXp(tx: Transaction, userId: string) {
  const from = startOfDay(new Date()); from.setDate(1);
  const aggregate = await tx.xpEvent.aggregate({ where: { userId, createdAt: { gte: from } }, _sum: { delta: true } });
  return aggregate._sum.delta ?? 0;
}

export function serializeUser<T extends { telegramId: bigint; income?: string | null }>(user: T) {
  return {
    ...user,
    telegramId: user.telegramId.toString(),
    username: 'username' in user ? (user.username ?? '') : '',
    name: 'name' in user ? (user.name ?? '') : '',
    phone: 'phone' in user ? (user.phone ?? '') : '',
    location: 'location' in user ? (user.location ?? '') : '',
    occupation: 'occupation' in user ? (user.occupation ?? '') : '',
    income: user.income ?? '',
    goal: 'goal' in user ? (user.goal ?? '') : '',
  };
}

export function isPrismaConflict(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && (error as Prisma.PrismaClientKnownRequestError).code === 'P2002';
}
