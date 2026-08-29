import assert from 'node:assert/strict';
import test from 'node:test';
import type { PrismaClient } from '@prisma/client';
import { planScheduledNotifications, startRecoveringLoop, type AutomationConfig } from './automation.js';

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

const automationConfig: AutomationConfig = {
  webAppUrl: 'https://example.com',
  timeZone: 'Asia/Almaty',
  dailyPlanHour: 9,
  weeklyCuratorHour: 10,
  weeklyMatchHour: 12,
  streakRiskHour: 21,
  intervalMs: 60_000,
};

test('daily notifications include pending users while member-only messages require approval', async () => {
  const created: Array<{ userId: string; type: string }> = [];
  const prisma = {
    user: { findMany: async () => [
      { id: 'approved', timeZone: 'Asia/Almaty', status: 'approved' },
      { id: 'pending', timeZone: 'Asia/Almaty', status: 'pending' },
    ] },
    botNotification: { createMany: async ({ data }: { data: Array<{ userId: string; type: string }> }) => { created.push(...data); } },
  } as unknown as PrismaClient;

  await planScheduledNotifications(prisma, new Date('2026-08-24T18:30:00.000Z'), automationConfig);

  const approvedTypes = created.filter(item => item.userId === 'approved').map(item => item.type).sort();
  const pendingTypes = created.filter(item => item.userId === 'pending').map(item => item.type).sort();
  assert.deepEqual(approvedTypes, ['dailyPlan', 'introLesson', 'streakRisk', 'weeklyCurator', 'weeklyMatch']);
  assert.deepEqual(pendingTypes, ['dailyPlan', 'streakRisk']);
});

test('scheduler recovers after a tick exceeds its deadline', async () => {
  let calls = 0;
  const errors: unknown[] = [];
  const stop = startRecoveringLoop({
    intervalMs: 10,
    timeoutMs: 20,
    heartbeatMs: 1_000,
    run: async () => {
      calls += 1;
      if (calls === 1) await new Promise<void>(() => undefined);
    },
    logError: (_message, error) => errors.push(error),
  });

  try {
    await wait(75);
    assert.ok(calls >= 2, `expected a retry after timeout, got ${calls} call(s)`);
    assert.equal(errors.length, 1);
    assert.match(String(errors[0]), /timed out/);
  } finally {
    stop();
  }
});

test('scheduler does not overlap healthy ticks', async () => {
  let active = 0;
  let maxActive = 0;
  const stop = startRecoveringLoop({
    intervalMs: 5,
    timeoutMs: 100,
    heartbeatMs: 1_000,
    run: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await wait(20);
      active -= 1;
    },
  });

  try {
    await wait(65);
    assert.equal(maxActive, 1);
  } finally {
    stop();
  }
});
