import { describe, expect, it } from 'vitest';
import { DirectOutputChild } from './tests/DirectOutputChild.js';
import { DirectOutputParent } from './tests/DirectOutputParent.js';
import { hasValue } from './tests/typeguards.js';
import { TestHarness } from './tests/TestHarness.js';

describe('output bindings (direct child)', () =>
{
    it('should invoke parent handler when direct child component output emits', async() =>
    {
        TestHarness.setExpressionTable([], [
            (t: unknown, _l: Record<string, unknown>, e: unknown): void =>
            {
                if (t instanceof DirectOutputParent && hasValue(e))
                {
                    t.onSubmit(e);
                    return;
                }
                throw new Error('Invalid type');
            }
        ]);

        TestHarness.defineCustomElement('direct-output-parent', DirectOutputParent);

        const el = TestHarness.mount('direct-output-parent');
        if (!(el instanceof DirectOutputParent))
        {
            throw new Error('Expected DirectOutputParent');
        }

        TestHarness.defineCustomElement('direct-output-child', DirectOutputChild);

        await TestHarness.tick(6);

        const child = el.shadowRoot?.querySelector('direct-output-child');
        if (!(child instanceof DirectOutputChild))
        {
            throw new Error('Expected DirectOutputChild');
        }

        child.emitSubmit('test-value');

        await TestHarness.tick(6);

        expect(el.receivedValue)
            .toBe('test-value');

        el.remove();
    });
});
