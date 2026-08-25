import assert from 'node:assert/strict';
import test from 'node:test';
import { bareBaiInvocationReply, GroupConversationResponder, groupPersonalityInstructions, isAutomatedGroupSender, isBaiInvocation, isContextualContinuation, sanitizeGroupReply, shouldHandleGroupText } from './group-chat.js';

const message = { chatId: '-1001', chatTitle: 'Тест', messageId: 1, senderId: '7', senderName: 'Алан', username: 'alan', text: 'Как быстро проверить оффер?' };

test('ignores commands, empty messages and other bots', () => {
  assert.equal(shouldHandleGroupText('/start', false), false);
  assert.equal(shouldHandleGroupText('   ', false), false);
  assert.equal(shouldHandleGroupText('Привет', true), false);
  assert.equal(shouldHandleGroupText('Привет', false), true);
});

test('accepts human messages sent as a channel but ignores real bots', () => {
  assert.equal(isAutomatedGroupSender(true, true, false), false);
  assert.equal(isAutomatedGroupSender(true, false, false), true);
  assert.equal(isAutomatedGroupSender(true, true, true), true);
  assert.equal(isAutomatedGroupSender(false, false, false), false);
});

test('continues only a recent conversation with the same sender', () => {
  assert.equal(isContextualContinuation({ sameSender: true, elapsedMs: 10_000, messageGap: 2 }), true);
  assert.equal(isContextualContinuation({ sameSender: false, elapsedMs: 10_000, messageGap: 2 }), false);
  assert.equal(isContextualContinuation({ sameSender: true, elapsedMs: 6 * 60_000, messageGap: 2 }), false);
  assert.equal(isContextualContinuation({ sameSender: true, elapsedMs: 10_000, messageGap: 8 }), false);
});

test('keeps replies brief and removes a redundant persona prefix', () => {
  assert.equal(sanitizeGroupReply('BAI: Проверь на трёх клиентах.'), 'Проверь на трёх клиентах.');
  assert.ok(sanitizeGroupReply('x'.repeat(900)).length <= 700);
  assert.match(groupPersonalityInstructions, /AI-бот/);
  assert.match(groupPersonalityInstructions, /1–2 предложения/);
});

test('recognizes Bai as a direct call without false positives', () => {
  assert.equal(isBaiInvocation('Бай, что думаешь?'), true);
  assert.equal(isBaiInvocation('эй bai!'), true);
  assert.equal(isBaiInvocation('BAI'), true);
  assert.equal(isBaiInvocation('БАИ'), true);
  assert.equal(isBaiInvocation('bay?'), true);
  assert.equal(isBaiInvocation('Бэй!'), true);
  assert.equal(isBaiInvocation('бей, подскажи'), true);
  assert.equal(isBaiInvocation('Bай'), true);
  assert.equal(isBaiInvocation('Бaй'), true);
  assert.equal(isBaiInvocation('baй'), true);
  assert.equal(isBaiInvocation('Байчик, ты тут?'), true);
  assert.equal(isBaiInvocation('Байкал красивый'), false);
  assert.equal(isBaiInvocation('bail out'), false);
  assert.equal(isBaiInvocation('байка смешная'), false);
  assert.match(bareBaiInvocationReply('Бай!!!', 1) ?? '', /.+/);
  assert.equal(bareBaiInvocationReply('Бай, помоги с оффером', 1), null);
});

test('keeps short per-chat context and enforces a daily cap', async () => {
  const inputs: string[] = [];
  const responder = new GroupConversationResponder({ dailyLimitPerChat: 2, maxContextMessages: 2 }, async request => {
    inputs.push(request.input);
    return 'Конкретный следующий шаг: покажи оффер трём людям.';
  });
  assert.ok(await responder.reply(message, new Date('2026-08-25T10:00:00Z')));
  assert.ok(await responder.reply({ ...message, messageId: 2, text: 'А дальше?' }, new Date('2026-08-25T10:01:00Z')));
  assert.equal(await responder.reply({ ...message, messageId: 3, text: 'Ещё?' }, new Date('2026-08-25T10:02:00Z')), null);
  assert.match(inputs[1]!, /Как быстро проверить оффер/);
});
