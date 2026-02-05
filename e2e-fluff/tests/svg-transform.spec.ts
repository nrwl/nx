import { expect, test } from '@playwright/test';

test.describe('SVG transform attribute binding', () =>
{
    test('should set transform attribute on SVG g element', async({ page }) =>
    {
        await page.goto('/');

        const g = page.locator('#test-group');
        await expect(g).toHaveAttribute('transform', 'rotate(45,50,50)');
    });
});
