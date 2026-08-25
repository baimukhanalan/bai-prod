import crypto from 'node:crypto';

export type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
};

export function validateInitData(initData: string, botToken: string, maxAgeSeconds = 3600): TelegramUser {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get('hash');
  if (!receivedHash) throw new Error('Telegram hash is missing');

  params.delete('hash');
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const expected = Buffer.from(expectedHash, 'hex');
  const received = Buffer.from(receivedHash, 'hex');
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) {
    throw new Error('Telegram signature is invalid');
  }

  const authDate = Number(params.get('auth_date'));
  const ageSeconds = Date.now() / 1000 - authDate;
  if (!Number.isFinite(authDate) || ageSeconds > maxAgeSeconds || ageSeconds < -30) {
    throw new Error('Telegram authorization has expired');
  }

  const rawUser = params.get('user');
  if (!rawUser) throw new Error('Telegram user is missing');
  const user = JSON.parse(rawUser) as TelegramUser;
  if (!Number.isSafeInteger(user.id)) throw new Error('Telegram user id is invalid');
  return user;
}
