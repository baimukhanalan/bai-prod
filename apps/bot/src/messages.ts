type PublicProfile = {
  name: string | null;
  username?: string | null;
  location: string | null;
  occupation: string | null;
  goal: string | null;
  giveTags: string[];
  seekTags: string[];
};

export function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function displayName(user: PublicProfile) {
  return escapeHtml(user.name || user.username || 'Участник BAI.PROD');
}

function interests(user: PublicProfile) {
  return [...new Set([...user.giveTags, ...user.seekTags])].slice(0, 8).map(escapeHtml).join(', ') || 'пока не указаны';
}

export function profileCard(user: PublicProfile) {
  return `👤 <b>${displayName(user)}</b>${user.location ? `, ${escapeHtml(user.location)}` : ''}\n💼 ${escapeHtml(user.occupation || 'Развиваюсь в AI')}\n🎯 ${escapeHtml(user.goal || 'Хочу расти и находить сильные связи')}\nИнтересы: ${interests(user)}`;
}

export const introLessonText = `🎬 <b>Вводный урок — первый шаг к $1–2k/мес на AI</b>

<b>Теперь ты понимаешь, как устроена AI-индустрия, где находятся деньги и какие направления сегодня действительно востребованы.</b>

Следующий этап проходит в закрытом Telegram-канале.

<b>Там я регулярно публикую:</b>
• разборы AI-инструментов;
• закрытые эфиры;
• кейсы учеников;
• дополнительные материалы и инструкции.

После вступления тебе сразу откроются 3 бесплатных урока по самым востребованным направлениям AI, чтобы ты смог понять, какое из них подойдёт именно тебе.`;

export function matchRequestText(sender: PublicProfile) {
  return `💬 <b>Заявка на знакомство</b>\n\n${profileCard(sender)}\n\nУчастник хочет с тобой пообщаться. Если примешь — я пришлю контакты вам обоим, и написать первым сможет любой.`;
}

export function matchAcceptedText(other: PublicProfile, acceptedByCurrentUser: boolean) {
  const name = displayName(other);
  return acceptedByCurrentUser
    ? `✅ Принято — контакт ${name} отправлю тебе следующим сообщением, а ему — твой.`
    : `✅ ${name} принял твою заявку. Сейчас пришлю контакт вам обоим.`;
}

export function matchContactText(other: PublicProfile) {
  return `🤝 Знакомство с <b>${displayName(other)}</b> открыто!\n\nВот контакт — писать первым может любой из вас:`;
}

export function dailyPlanText(incompleteTasks: number) {
  if (incompleteTasks === 0) return `☀️ <b>Твой план на сегодня</b>\n\nВсе задачи на сегодня закрыты. Отличная работа — сохрани темп 🔥`;
  const noun = incompleteTasks % 10 === 1 && incompleteTasks % 100 !== 11 ? 'задача ждёт' : 'задач ждут';
  return `☀️ <b>Твой план на сегодня</b>\n\n📚 Академия: ${incompleteTasks} ${noun} — открой «✅ Дисциплина», забери XP.\n\nОдин шаг — и день пошёл 🔥`;
}

export const weeklyCuratorText = `<b>Неделя началась. Хочешь план на неё от куратора?</b>\n\nНапиши куратору кодовое слово <b>Разбор</b> — по нему он поймёт, откуда ты. Ответит в течение 1 часа.`;

export function streakRiskText(streakDays: number) {
  return `🔥 Серия <b>${streakDays} дн.</b> под угрозой!\nОтметь хотя бы одно действие до полуночи — не обнуляйся.`;
}

export function weeklyMatchText(candidate: PublicProfile) {
  return `🤝 <b>Знакомство недели!</b>\n\n${profileCard(candidate)}\n\nПонравилась анкета — отправь заявку на знакомство. Как только участник её примет, я пришлю тебе контакт 🙌`;
}
