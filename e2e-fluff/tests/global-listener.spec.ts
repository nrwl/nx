import { expect, test } from '@playwright/test';

test.describe('Global HostListener', () =>
{
    test('should handle document:mousemove events', async({ page }) =>
    {
        await page.goto('/');

        const moveResult = page.locator('#mousemove-result');
        await expect(moveResult).toHaveText('0');

        await page.mouse.move(100, 100);
        await page.mouse.move(200, 200);
        await page.mouse.move(300, 300);

        await expect(moveResult).not.toHaveText('0');
    });

    test('should handle document:click events', async({ page }) =>
    {
        await page.goto('/');

        const clickResult = page.locator('#click-result');
        await expect(clickResult).toHaveText('0');

        await page.click('body');

        await expect(clickResult).toHaveText('1');

        await page.click('body');

        await expect(clickResult).toHaveText('2');
    });
});
