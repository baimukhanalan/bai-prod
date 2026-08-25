import { expect, test, type Page } from '@playwright/test';

function watchRuntimeIssues(page: Page) {
  const issues: string[] = [];
  page.on('pageerror', error => issues.push(`pageerror: ${error.message}`));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') issues.push(`${message.type()}: ${message.text()}`);
  });
  return issues;
}

test('loads the Mini App and opens every primary section', async ({ page }) => {
  const issues = watchRuntimeIssues(page);
  await page.goto('/');

  await expect(page).toHaveTitle('BAI.PROD');
  await expect(page.getByText('Привет,', { exact: false })).toBeVisible();
  await expect(page.locator('.app-shell')).toBeVisible();

  for (const [navigation, heading] of [
    ['Обучение', 'Твой путь'],
    ['Помощник', 'Твой наставник'],
    ['Люди', 'Твои знакомства'],
    ['Профиль', 'Алан'],
    ['Главная', 'Привет,'],
  ]) {
    await page.getByRole('button', { name: navigation, exact: true }).click();
    await expect(page.getByText(heading, { exact: false }).first()).toBeVisible();
  }

  expect(issues).toEqual([]);
});

test('creates, completes and removes a 1-3-5 task with correct XP', async ({ page }) => {
  const issues = watchRuntimeIssues(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Профиль', exact: true }).click();
  await page.getByRole('button', { name: 'Результаты', exact: true }).click();
  const xpValue = page.locator('.stats-grid > div').filter({ hasText: 'Опыт · XP' }).locator('strong');
  const initialXp = Number(await xpValue.textContent());
  await page.getByRole('button', { name: 'Главная', exact: true }).click();

  await page.getByRole('button', { name: 'Добавить задачу' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByPlaceholder('Например, написать оффер').fill('E2E задача');
  await dialog.getByRole('button', { name: 'Маленькая' }).click();
  await dialog.getByRole('button', { name: 'Добавить', exact: true }).click();

  const task = page.locator('.task-row').filter({ hasText: 'E2E задача' });
  await expect(task).toBeVisible();
  await task.locator('.task-toggle').click();
  await expect(page.getByText('+5 XP начислено')).toBeVisible();
  await expect(task).toHaveClass(/done/);

  await page.getByRole('button', { name: 'Профиль', exact: true }).click();
  await page.getByRole('button', { name: 'Результаты', exact: true }).click();
  await expect(xpValue).toHaveText(String(initialXp + 5));
  await page.getByRole('button', { name: 'Главная', exact: true }).click();

  page.once('dialog', dialogEvent => dialogEvent.accept());
  await task.getByRole('button', { name: 'Удалить задачу E2E задача' }).click();
  await expect(task).toHaveCount(0);
  await page.getByRole('button', { name: 'Профиль', exact: true }).click();
  await page.getByRole('button', { name: 'Результаты', exact: true }).click();
  await expect(xpValue).toHaveText(String(initialXp));
  expect(issues).toEqual([]);
});

test('completes an academy lesson, asks the mentor and records a result', async ({ page }) => {
  const issues = watchRuntimeIssues(page);
  await page.goto('/');

  await page.getByRole('button', { name: 'Обучение', exact: true }).click();
  await page.getByRole('button', { name: /2\. Выбор ниши/ }).click();
  await page.getByRole('button', { name: /Завершить урок/ }).click();
  await expect(page.getByText(/Урок завершён/)).toBeVisible();

  await page.getByRole('button', { name: 'Помощник', exact: true }).click();
  await page.getByRole('button', { name: 'Разбери мой оффер', exact: true }).click();
  await expect(page.locator('.message.assistant')).toContainText('следующий шаг');
  await expect(page.getByText('Осталось 4 вопроса на сегодня')).toBeVisible();

  await page.getByRole('button', { name: 'Люди', exact: true }).click();
  await page.getByRole('button', { name: 'Рейтинг', exact: true }).click();
  await expect(page.getByText('maksbond')).toBeVisible();
  await expect(page.getByText('Твоя позиция')).toBeVisible();

  await page.getByRole('button', { name: 'Профиль', exact: true }).click();
  await page.getByRole('button', { name: 'Результаты', exact: true }).click();
  await page.getByRole('button', { name: '+ Созвон', exact: true }).click();
  await page.getByPlaceholder('Что получилось?').fill('E2E проверка');
  await page.getByRole('button', { name: 'Добавить результат' }).click();
  const journalEntry = page.locator('.journal > div').filter({ hasText: 'Созвон · E2E проверка' });
  await expect(journalEntry).toBeVisible();
  await journalEntry.getByRole('button', { name: 'Удалить запись' }).click();
  await expect(journalEntry).toHaveCount(0);

  await page.getByRole('button', { name: 'Дисциплина', exact: true }).click();
  await expect(page.locator('.activity-grid > span')).toHaveCount(28);
  expect(issues).toEqual([]);
});

test('enforces lesson order and opens the free access card', async ({ page }) => {
  const issues = watchRuntimeIssues(page);
  await page.goto('/');
  await page.getByRole('button', { name: 'Обучение', exact: true }).click();

  await page.getByRole('button', { name: /Бесплатный доступ/ }).click();
  await expect(page.getByText('Выбор ниши', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Дальше' })).toBeDisabled();

  await page.getByRole('button', { name: /Завершить урок/ }).click();
  await expect(page.getByRole('button', { name: 'Дальше' })).toBeEnabled();
  await page.getByRole('button', { name: 'Дальше' }).click();
  await expect(page.getByText('Сильный оффер', { exact: true })).toBeVisible();
  expect(issues).toEqual([]);
});
