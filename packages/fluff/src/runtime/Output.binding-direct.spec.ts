import { describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { DirectOutputChild } from './tests/DirectOutputChild.js';
import { DirectOutputParent } from './tests/DirectOutputParent.js';

describe('output bindings (direct child)', () =>
{
    it('should invoke parent handler when direct child component output emits', async() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
        FluffBase.__h[0] = (t: DirectOutputParent, _l: unknown, e: { value: string }): void =>
        {
            t.onSubmit(e);
        };

        if (!customElements.get('direct-output-parent'))
        {
            customElements.define('direct-output-parent', DirectOutputParent);
        }

        const el = document.createElement('direct-output-parent');
        if (!(el instanceof DirectOutputParent))
        {
            throw new Error('Expected DirectOutputParent');
        }
        document.body.appendChild(el);

        if (!customElements.get('direct-output-child'))
        {
            customElements.define('direct-output-child', DirectOutputChild);
        }

        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        const child = el.shadowRoot?.querySelector('direct-output-child');
        if (!(child instanceof DirectOutputChild))
        {
            throw new Error('Expected DirectOutputChild');
        }

        child.emitSubmit('test-value');

        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        expect(el.receivedValue)
            .toBe('test-value');

        el.remove();
    });
});
