import type { OnboardingStep } from '@prisma/client';

export const onboardingPrompts: Record<OnboardingStep, string> = {
  name: 'Как тебя зовут?',
  phone: 'Поделись номером телефона или нажми «Пропустить».',
  age: 'Сколько тебе лет? Отправь число от 14 до 100.',
  location: 'Из какой ты страны и города?',
  occupation: 'Чем ты сейчас занимаешься?',
  income: 'Какой у тебя текущий доход? Можно указать диапазон.',
  goal: 'Какая твоя главная цель на ближайшие 3 месяца?',
  give: 'Что ты можешь дать другим участникам? Перечисли через запятую, например: автоматизация, дизайн, продажи.',
  seek: 'Что ты ищешь в сообществе? Перечисли через запятую, например: клиенты, партнёрство, наставник.',
  completed: 'Анкета уже заполнена.',
};

export const nextOnboardingStep: Record<Exclude<OnboardingStep, 'completed'>, OnboardingStep> = {
  name: 'phone',
  phone: 'age',
  age: 'location',
  location: 'occupation',
  occupation: 'income',
  income: 'goal',
  goal: 'give',
  give: 'seek',
  seek: 'completed',
};
