import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateInitData } from './telegram-auth.js';

function signedInitData(token: string, authDate = Math.floor(Date.now() / 1000)) {
  const params = new URLSearchParams({
    auth_date: String(authDate),
    query_id: 'AAH-test',
    user: JSON.stringify({ id: 123456789, first_name: 'Алан', username: 'alan' }),
  });
  const dataCheckString = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest();
  params.set('hash', crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex'));
  return params.toString();
}

test('accepts a correctly signed Telegram payload', () => {
  const token = '123456789:abcdefghijklmnopqrstuvwxyzABCDE';
  assert.equal(validateInitData(signedInitData(token), token).id, 123456789);
});

test('rejects a tampered Telegram payload', () => {
  const token = '123456789:abcdefghijklmnopqrstuvwxyzABCDE';
  const tampered = signedInitData(token).replace('%D0%90%D0%BB%D0%B0%D0%BD', '%D0%98%D0%B2%D0%B0%D0%BD');
  assert.throws(() => validateInitData(tampered, token), /signature/);
});

test('rejects an expired Telegram payload', () => {
  const token = '123456789:abcdefghijklmnopqrstuvwxyzABCDE';
  assert.throws(() => validateInitData(signedInitData(token, Math.floor(Date.now() / 1000) - 7200), token), /expired/);
});

test('rejects a payload dated too far in the future', () => {
  const token = '123456789:abcdefghijklmnopqrstuvwxyzABCDE';
  assert.throws(() => validateInitData(signedInitData(token, Math.floor(Date.now() / 1000) + 120), token), /expired/);
});

