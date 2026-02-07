import { expect, test } from '@playwright/test';

test.describe('@ViewChild decorator', () =>
{
    test('should access template element via @ViewChild', async({ page }) =>
    {
        await page.goto('/');

        const input = page.locator('viewchild-test input');
        const result = page.locator('#viewchild-result');
        const btn = page.locator('#viewchild-btn');

        await expect(result).toHaveText('');

        await btn.click();
        await expect(result).toHaveText('initial');

        await input.fill('updated value');
        await btn.click();
        await expect(result).toHaveText('updated value');
    });
});
