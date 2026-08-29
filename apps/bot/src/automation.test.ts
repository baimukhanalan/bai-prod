import assert from 'node:assert/strict';
import test from 'node:test';
import { startRecoveringLoop } from './automation.js';

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

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
