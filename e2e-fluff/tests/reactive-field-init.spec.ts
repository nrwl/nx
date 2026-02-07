import { expect, test } from '@playwright/test';

test.describe('Reactive field initializer', () =>
{
    test('should allow field initializers to access reactive properties', async({ page }) =>
    {
        await page.goto('/');

        const itemsCount = page.locator('#items-count');
        const derivedValue = page.locator('#derived-value');

        await expect(itemsCount).toHaveText('3');
        await expect(derivedValue).toHaveText('30');
    });
});
