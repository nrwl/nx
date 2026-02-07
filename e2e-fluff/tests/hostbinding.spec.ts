import { expect, test } from '@playwright/test';

test.describe('@HostBinding decorator', () =>
{
    test('should bind class to host element via getter', async({ page }) =>
    {
        await page.goto('/');

        const host = page.locator('hostbinding-test');
        const btn = page.locator('#hostbinding-btn');

        await expect(host).not.toHaveClass(/is-active/);

        await btn.click();
        await expect(host).toHaveClass(/is-active/);

        await btn.click();
        await expect(host).not.toHaveClass(/is-active/);
    });

    test('should bind attribute to host element via getter', async({ page }) =>
    {
        await page.goto('/');

        const host = page.locator('hostbinding-test');
        const btn = page.locator('#hostbinding-btn');

        await expect(host).toHaveAttribute('data-state', 'off');

        await btn.click();
        await expect(host).toHaveAttribute('data-state', 'on');

        await btn.click();
        await expect(host).toHaveAttribute('data-state', 'off');
    });
});
