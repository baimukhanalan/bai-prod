import type { Course, Dashboard, Leaderboard, Member } from './types';

const today = new Date();
const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
const day = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).toISOString();

export const demoCourses: Course[] = [{
  id: 'course-free', slug: 'ai-start', title: 'Бесплатный мини-курс', description: 'Пойми, как зарабатывать на AI, и сделай первый практический шаг.', access: 'free', locked: false,
  lessons: [
    { id: 'l1', slug: 'start', title: 'Карта AI-возможностей', description: 'Определи самый быстрый путь к результату.', body: 'Выбери одну аудиторию, одну проблему и один измеримый результат.', kind: 'video', durationMinutes: 8, sortOrder: 0, xpReward: 20, isCompleted: true },
    { id: 'l2', slug: 'niche', title: 'Выбор ниши', description: 'Проверь спрос и свои сильные стороны.', body: 'Оцени рынок по срочности проблемы, бюджету и доступу к клиентам.', kind: 'text', durationMinutes: 7, sortOrder: 1, xpReward: 20, isCompleted: false },
    { id: 'l3', slug: 'offer', title: 'Сильный оффер', description: 'Собери понятное предложение.', body: 'Оффер отвечает: кому, какой результат, за какой срок и почему тебе можно верить.', kind: 'video', durationMinutes: 9, sortOrder: 2, xpReward: 20, isCompleted: false },
    { id: 'l4', slug: 'client', title: 'Первый клиент', description: 'План первых касаний.', body: 'Начни с десяти тёплых контактов и персонального предложения.', kind: 'audio', durationMinutes: 7, sortOrder: 3, xpReward: 20, isCompleted: false },
  ],
}, { id: 'course-full', slug: 'academy-full', title: 'Academy Full', description: 'Полная программа построения AI-бизнеса.', access: 'full', locked: true, lessons: [] }, { id: 'course-vip', slug: 'vip', title: 'VIP', description: 'Персональный трек с куратором.', access: 'vip', locked: true, lessons: [] }];

export const demoDashboard: Dashboard = {
  user: { id: 'demo', telegramId: '777000', name: 'Алан', username: 'alan_baimukhan', location: 'Казахстан, Алматы', occupation: 'AI-продюсер', income: '500 000 ₸', goal: 'Запустить продукт и найти первых клиентов', giveTags: ['AI-инструменты', 'Автоматизация'], seekTags: ['Партнёрство', 'Клиенты'], isDiscoverable: true, status: 'approved', access: 'free', xp: 240, monthlyXp: 180, streakDays: 7, bestStreak: 12, level: 'Новичок' },
  aiRemaining: 5,
  tasks: [
    { id: 't1', title: 'Сформулировать оффер', type: 'main', date: day(today), isCompleted: false, xpReward: 15 },
    { id: 't2', title: 'Написать трём потенциальным клиентам', type: 'medium', date: day(today), isCompleted: true, xpReward: 10 },
    { id: 't3', title: 'Обновить описание профиля', type: 'small', date: day(today), isCompleted: false, xpReward: 5 },
    { id: 't4', title: 'Собрать референсы продукта', type: 'medium', date: day(tomorrow), isCompleted: false, xpReward: 10 },
  ],
  results: [], activities: Array.from({ length: 14 }, (_, index) => ({ id: `a${index}`, date: day(new Date(today.getFullYear(), today.getMonth(), today.getDate() - index * 2)), score: 1 })),
  courses: demoCourses, stats: { completedTasks: 18, completedLessons: 1 }, serverTime: new Date().toISOString(),
  content: [
    { id: 'c1', kind: 'live', title: 'Разбор AI-офферов', description: 'Еженедельный практический эфир' },
    { id: 'c2', kind: 'article', title: 'Как выбрать нишу за один вечер', description: 'Пошаговый фильтр спроса' },
    { id: 'c3', kind: 'podcast', title: 'Первые 100 000 ₸ на AI-услугах', description: 'Разговор с участником' },
    { id: 'c4', kind: 'community', title: 'Закрытое сообщество', description: 'Нетворкинг и поддержка' },
    { id: 'c5', kind: 'roadmap', title: 'Твой AI-роудмэп', description: 'Маршрут до первых продаж' },
    { id: 'c6', kind: 'event', title: 'Networking call', description: 'Ближайшая встреча участников' },
  ],
};

export const demoMembers: Member[] = [
  { id: 'm1', name: 'Дана Искакова', username: 'dana', location: 'Алматы', occupation: 'Маркетолог', goal: 'Ищу партнёров для запуска', giveTags: ['Маркетинг', 'Контент'], seekTags: ['Партнёрство'] },
  { id: 'm2', name: 'Тимур Ахметов', username: 'timur', location: 'Астана', occupation: 'AI-разработчик', goal: 'Даю экспертизу по автоматизации', giveTags: ['AI', 'Автоматизация'], seekTags: ['Клиенты'] },
  { id: 'm3', name: 'Алина Ким', username: 'alina', location: 'Бишкек', occupation: 'Продюсер', goal: 'Ищу экспертов и коллаборации', giveTags: ['Продажи', 'Запуски'], seekTags: ['Эксперты'] },
];

export const demoLeaderboard: Leaderboard = { leaders: [['maksbond', 2590], ['Дмитрий', 2220], ['Валос', 1935], ['Саша', 1325], ['Алексей', 1285], ['Александр', 1105], ['Арина', 1100], ['Катя Крылова', 1085], ['Эльдар', 805], ['Владимир', 765]].map(([name, score], index) => ({ id: `p${index}`, name: String(name), score: Number(score) })), me: { id: 'demo', name: 'Алан', score: 180, position: 24 } };

