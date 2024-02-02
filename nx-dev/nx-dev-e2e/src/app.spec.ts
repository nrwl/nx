import { test, expect } from '@playwright/test';

test('should display the primary heading', async ({ page }) => {
  await page.goto('/');
  const heading = page.locator('[data-cy="primary-heading"]');
  await expect(heading).toContainText('Smart MonoreposFast CI');
});
