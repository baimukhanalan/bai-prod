import assert from 'node:assert/strict';
import test from 'node:test';
import { levelForXp, startOfDay } from './gamification.js';

test('maps XP to stable product levels', () => {
  assert.equal(levelForXp(0), 'Новичок');
  assert.equal(levelForXp(500), 'AI Student');
  assert.equal(levelForXp(1500), 'Builder');
  assert.equal(levelForXp(3500), 'AI Pro');
});

test('normalizes dates to a day boundary', () => {
  const value = startOfDay(new Date('2026-08-24T18:42:11+05:00'));
  assert.equal(value.getHours(), 0);
  assert.equal(value.getMinutes(), 0);
});
