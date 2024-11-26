import { test, expect } from '@playwright/test';

test.describe('nx-dev: Recipes pages', () => {
  test('should list related recipes based on tags', async ({ page }) => {
    await page.goto('/recipes/storybook/overview-react');
    const relatedDocs = page.locator('[data-document="related"] li');
    const relatedDocsText = await relatedDocs.allInnerTexts();
    expect(relatedDocsText.length, 'has related docs').toBeGreaterThan(0);

    // All text content has to be different
    const distinct = new Set(relatedDocsText);
    expect(distinct.size, 'all strings are different').toBe(
      relatedDocsText.length
    );
  });
});
