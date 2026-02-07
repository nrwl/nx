import { expect, test } from '@playwright/test';

test.describe('Standalone pipe', () =>
{
    test('should transform value using standalone @Pipe class', async({ page }) =>
    {
        await page.goto('/');

        const pipeResult = page.locator('#pipe-result');
        await expect(pipeResult).toHaveText('HELLO WORLD');
    });
});
