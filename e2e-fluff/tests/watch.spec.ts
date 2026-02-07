import { expect, test } from '@playwright/test';

test.describe('@Watch decorator', () =>
{
    test('should call watch method when reactive property changes', async({ page }) =>
    {
        await page.goto('/');

        const input = page.locator('#watch-input');
        const result = page.locator('#watch-result');

        await expect(result).toHaveText('0');

        await input.fill('a');
        await expect(result).toHaveText('1');

        await input.fill('ab');
        await expect(result).toHaveText('2');

        await input.fill('abc');
        await expect(result).toHaveText('3');
    });
});
