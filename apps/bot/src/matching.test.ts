import assert from 'node:assert/strict';
import test from 'node:test';
import { chooseCandidate, matchScore, pairKey, parseTags } from './matching.js';

const user = { id: 'b', location: 'Алматы', occupation: 'Продюсер', giveTags: ['Контент'], seekTags: ['Автоматизация'] };
const strong = { id: 'c', location: 'Астана', occupation: 'Разработчик', giveTags: ['Автоматизация'], seekTags: ['Контент'] };
const weak = { id: 'a', location: 'Алматы', occupation: 'Дизайнер', giveTags: ['Дизайн'], seekTags: ['Клиенты'] };

test('prioritizes complementary give/seek interests', () => {
  assert.ok(matchScore(user, strong) > matchScore(user, weak));
  assert.equal(chooseCandidate(user, [weak, strong])?.id, strong.id);
});

test('produces the same pair key in both directions', () => {
  assert.equal(pairKey('user-b', 'user-a'), pairKey('user-a', 'user-b'));
});

test('normalizes unique onboarding give and seek tags', () => {
  assert.deepEqual(parseTags('Автоматизация, Контент; автоматизация\nAI-инструменты'), ['Автоматизация', 'Контент', 'AI-инструменты']);
  assert.equal(parseTags('AI, Продажи, Дизайн', 2).length, 2);
});
