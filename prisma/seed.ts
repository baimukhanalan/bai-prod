import { ContentKind, CourseAccess, LessonKind, PrismaClient, TaskType, UserStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.upsert({
    where: { telegramId: 777000n }, update: {},
    create: {
      telegramId: 777000n, username: 'alan_demo', name: 'Алан', location: 'Казахстан, Алматы', occupation: 'AI-продюсер',
      income: '500000', goal: 'Собрать продукт и найти первых клиентов', giveTags: ['AI-инструменты', 'Автоматизация'],
      seekTags: ['Партнёрство', 'Клиенты'], xp: 240, monthlyXp: 180, streakDays: 7, bestStreak: 12, status: UserStatus.approved,
    },
  });

  const course = await prisma.course.upsert({
    where: { slug: 'ai-start' },
    update: { isPublished: true },
    create: { slug: 'ai-start', title: 'Бесплатный мини-курс', description: 'Пойми, как зарабатывать на AI, и сделай первый практический шаг.', access: CourseAccess.free, isPublished: true },
  });
  const lessons = [
    ['start', 'Карта AI-возможностей', LessonKind.video, 8, 'Определи, где AI даст тебе самый быстрый результат.'],
    ['niche', 'Выбор ниши', LessonKind.text, 7, 'Проверь спрос, сильные стороны и скорость первого результата.'],
    ['offer', 'Сильный оффер', LessonKind.video, 9, 'Собери предложение, понятное клиенту за десять секунд.'],
    ['first-client', 'Первый клиент', LessonKind.audio, 7, 'План первых касаний и продаж без холодного спама.'],
  ] as const;
  for (const [index, lesson] of lessons.entries()) {
    await prisma.lesson.upsert({
      where: { courseId_slug: { courseId: course.id, slug: lesson[0] } },
      update: { isPublished: true },
      create: { courseId: course.id, slug: lesson[0], title: lesson[1], kind: lesson[2], durationMinutes: lesson[3], description: lesson[4], body: lesson[4], sortOrder: index, xpReward: 20, isPublished: true },
    });
  }
  await prisma.course.upsert({ where: { slug: 'academy-full' }, update: {}, create: { slug: 'academy-full', title: 'Academy Full', description: 'Полная программа построения AI-бизнеса.', access: CourseAccess.full, sortOrder: 1, isPublished: true } });
  await prisma.course.upsert({ where: { slug: 'vip' }, update: {}, create: { slug: 'vip', title: 'VIP', description: 'Персональный трек с куратором.', access: CourseAccess.vip, sortOrder: 2, isPublished: true } });

  const content = [
    [ContentKind.live, 'Разбор AI-офферов', 'Еженедельный практический эфир', null],
    [ContentKind.article, 'Как выбрать нишу за один вечер', 'Пошаговый фильтр спроса и компетенций', null],
    [ContentKind.podcast, 'Первые 100 000 ₸ на AI-услугах', 'Разговор с участником академии', null],
    [ContentKind.community, 'Закрытое сообщество BAI.PROD', 'Нетворкинг, разборы и поддержка', 'https://t.me/'],
    [ContentKind.roadmap, 'Твой AI-роудмэп', 'Маршрут от идеи до первых продаж', null],
    [ContentKind.event, 'Открытый networking call', 'Знакомства и обмен запросами', null],
  ] as const;
  for (const [index, item] of content.entries()) {
    const exists = await prisma.contentItem.findFirst({ where: { kind: item[0], title: item[1] } });
    if (!exists) await prisma.contentItem.create({ data: { kind: item[0], title: item[1], description: item[2], url: item[3], sortOrder: index, isPublished: true } });
  }

  if ((await prisma.task.count({ where: { userId: user.id } })) === 0) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    await prisma.task.createMany({ data: [
      { userId: user.id, title: 'Сформулировать оффер', type: TaskType.main, date: today, xpReward: 15 },
      { userId: user.id, title: 'Написать трём потенциальным клиентам', type: TaskType.medium, date: today, xpReward: 10 },
      { userId: user.id, title: 'Обновить описание профиля', type: TaskType.small, date: today, xpReward: 5 },
    ] });
  }
}

main().finally(() => prisma.$disconnect());

