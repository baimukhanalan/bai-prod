import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyPlanText, escapeHtml, matchRequestText, profileCard, streakRiskText } from './messages.js';

const profile = { name: 'Миша <AI>', username: 'misha', location: 'Россия', occupation: 'Строю агентство', goal: 'Найти клиентов', giveTags: ['AI-инструменты'], seekTags: ['Продажи'] };

test('escapes all user supplied profile fields for Telegram HTML', () => {
  const card = profileCard(profile);
  assert.match(card, /Миша &lt;AI&gt;/);
  assert.doesNotMatch(card, /<AI>/);
  assert.equal(escapeHtml('A&B'), 'A&amp;B');
});

test('renders a complete private match request without contact details', () => {
  const message = matchRequestText(profile);
  assert.match(message, /Заявка на знакомство/);
  assert.match(message, /Если примешь/);
  assert.doesNotMatch(message, /t\.me|telegram_id|phone/i);
});

test('uses correct daily-plan wording and completed state', () => {
  assert.match(dailyPlanText(1), /1 задача ждёт/);
  assert.match(dailyPlanText(4), /4 задач ждут/);
  assert.match(dailyPlanText(0), /Все задачи на сегодня закрыты/);
});

test('warns about an active streak before midnight', () => {
  const message = streakRiskText(1);
  assert.match(message, /Серия <b>1 дн\.<\/b> под угрозой/);
  assert.match(message, /до полуночи/);
});
