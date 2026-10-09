import { test, expect } from '@playwright/test';

test('should apply system theme by default', async ({ page }) => {
  await page.goto('/docs/getting-started/intro');

  await expect(
    page.getByRole('heading', { name: 'What is Nx?' })
  ).toBeVisible();

  const systemTheme = page.getByRole('button', { name: 'Use system theme' });

  await expect(systemTheme).toBeVisible();

  await expect(systemTheme).toHaveAttribute('aria-pressed', 'true');

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

  const lightTheme = page.getByRole('button', {
    name: 'Switch to light theme',
  });
  const darkTheme = page.getByRole('button', { name: 'Switch to dark theme' });
  const systemTheme = page.getByRole('button', { name: 'Use system theme' });

  await test.step('light theme renders', async () => {
    await expect(lightTheme).toBeVisible();

    await lightTheme.click();

    await expect(lightTheme).toHaveAttribute('aria-pressed', 'true');

    const dataTheme = await page.evaluate(
      () => document.documentElement.dataset.theme
    );
    expect(dataTheme).toBe('light');
  });

  await test.step('dark theme renders', async () => {
    await darkTheme.click();

    await expect(darkTheme).toHaveAttribute('aria-pressed', 'true');
    await expect(lightTheme).toHaveAttribute('aria-pressed', 'false');

    const dataTheme = await page.evaluate(
      () => document.documentElement.dataset.theme
    );
    expect(dataTheme).toBe('dark');
  });

  await test.step('switch back to auto', async () => {
    await systemTheme.click();

    await expect(systemTheme).toHaveAttribute('aria-pressed', 'true');

    const dataTheme = await page.evaluate(
      () => document.documentElement.dataset.theme
    );
    expect(['light', 'dark']).toContain(dataTheme);
  });
});
