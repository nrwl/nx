import { expect, test } from '@playwright/test';

test.describe('Style binding', () =>
{
    test('should set background-color style on element', async({ page }) =>
    {
        await page.goto('/');

        const div = page.locator('#test-div');
        await expect(div).toHaveCSS('background-color', 'rgb(255, 0, 0)');
    });
});
