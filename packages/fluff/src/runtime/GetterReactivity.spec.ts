import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestGetterReactivityComponent } from './tests/TestGetterReactivityComponent.js';
import { TestHarness } from './tests/TestHarness.js';

describe('getter reactivity', () =>
{
    beforeEach(() =>
    {
        TestHarness.setExpressionTable([
            (t: unknown): number =>
            {
                if (t instanceof TestGetterReactivityComponent)
                {
                    return t.itemCount;
                }
                throw new Error('Invalid type');
            }
        ], []);
    });

    afterEach(() =>
    {
        TestHarness.resetExpressionTable();
    });

    it('should update when underlying reactive properties used by a getter change', async() =>
    {
        TestHarness.defineCustomElement('test-getter-reactivity', TestGetterReactivityComponent);

        const el = TestHarness.mount('test-getter-reactivity');
        if (!(el instanceof TestGetterReactivityComponent))
        {
            throw new Error('Expected TestGetterReactivityComponent');
        }

        await TestHarness.tick();

        expect(el.shadowRoot?.querySelector('.count')
            ?.textContent
            ?.trim() ?? '')
            .toBe('0');

        el.items = ['a', 'b', 'c'];
        await TestHarness.tick(2);

        expect(el.shadowRoot?.querySelector('.count')
            ?.textContent
            ?.trim() ?? '')
            .toBe('3');

        el.remove();
    });
});
