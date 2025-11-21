import { test, expect } from '@playwright/test';

test('should apply system theme by default', async ({ page }) => {
  await page.goto('/docs/getting-started/intro');

  await expect(
    page.getByRole('heading', { name: 'What is Nx?' })
  ).toBeVisible();

  const themeSelector = page.getByRole('combobox', {
    name: /theme/i,
  });

  await expect(themeSelector).toBeVisible();

  await expect(themeSelector).toHaveValue('auto');

  const dataTheme = await page.evaluate(
    () => document.documentElement.dataset.theme
  );
  // The data-theme should be either 'light' or 'dark' based on system preference
  // It won't be 'auto' on the document element
  expect(['light', 'dark']).toContain(dataTheme);
});

test('should switch to between light and dark theme', async ({ page }) => {
  await page.goto('/docs/getting-started/intro');

  await expect(
    page.getByRole('heading', { name: 'What is Nx?' })
  ).toBeVisible();

  const themeSelector = page.getByRole('combobox', {
    name: /theme/i,
  });

  await test.step('light theme renders', async () => {
    await expect(themeSelector).toBeVisible();

    await themeSelector.selectOption('light');

    await expect(themeSelector).toHaveValue('light');

    const dataTheme = await page.evaluate(
      () => document.documentElement.dataset.theme
    );
    expect(dataTheme).toBe('light');
  });

  await test.step('dark theme renders', async () => {
    await themeSelector.selectOption('dark');

    await expect(themeSelector).toHaveValue('dark');

    const dataTheme = await page.evaluate(
      () => document.documentElement.dataset.theme
    );
    expect(dataTheme).toBe('dark');
  });

  await test.step('switch back to auto', async () => {
    await themeSelector.selectOption('auto');

    await expect(themeSelector).toHaveValue('auto');

    const dataTheme = await page.evaluate(
      () => document.documentElement.dataset.theme
    );
    expect(['light', 'dark']).toContain(dataTheme);
  });
});
