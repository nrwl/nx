import { expect, test } from '@playwright/test';

test.describe('Linked property options', () =>
{
    test('commitTrigger defers outbound commit until trigger truthy', async({ page }) =>
    {
        await page.goto('/');

        const raw = page.locator('#parent-raw');
        const committed = page.locator('#parent-committed');
        const childCommit = page.locator('#child-commit-value');
        const toggle = page.locator('#toggle-mouse-up');
        const set1 = page.locator('#set-commit-1');
        const set2 = page.locator('#set-commit-2');

        await expect(raw).toHaveText('0');
        await expect(committed).toHaveText('0');

        await set1.click();

        await expect(raw).toHaveText('1');
        await expect(childCommit).toHaveText('1');
        await expect(committed).toHaveText('0');

        await toggle.click();

        await expect(committed).toHaveText('1');

        await set2.click();

        await expect(raw).toHaveText('2');
        await expect(childCommit).toHaveText('2');
        await expect(committed).toHaveText('2');

        await toggle.click();

        await set1.click();

        await expect(raw).toHaveText('1');
        await expect(childCommit).toHaveText('1');
        await expect(committed).toHaveText('2');

        await toggle.click();

        await expect(committed).toHaveText('1');
    });

    test('direction controls linked subscriptions', async({ page }) =>
    {
        await page.goto('/');

        const inboundValue = page.locator('#child-inbound-value');
        const outboundValue = page.locator('#child-outbound-value');

        const setInboundInbound = page.locator('#set-inbound-inbound');
        const setInboundOutbound = page.locator('#set-inbound-outbound');
        const setOutboundInbound = page.locator('#set-outbound-inbound');
        const setOutboundOutbound = page.locator('#set-outbound-outbound');

        await expect(inboundValue).toHaveText('0');
        await expect(outboundValue).toHaveText('0');

        await setInboundOutbound.click();
        await expect(inboundValue).toHaveText('0');

        await setInboundInbound.click();
        await expect(inboundValue).toHaveText('11');

        await setOutboundInbound.click();
        await expect(outboundValue).toHaveText('0');

        await setOutboundOutbound.click();
        await expect(outboundValue).toHaveText('32');
    });
});
