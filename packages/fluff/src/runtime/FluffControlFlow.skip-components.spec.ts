import { beforeEach, describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { FluffElement } from './FluffElement.js';
import { hasValue } from './tests/typeguards.js';

describe('__processBindings should not search beneath x-fluff-component elements', () =>
{
    beforeEach(() =>
    {
        FluffBase.__e = [
            (t: unknown): string =>
            {
                if (hasValue(t))
                {
                    return t.value;
                }
                throw new Error('Invalid type');
            }
        ];
        FluffBase.__h = [];
    });

    it('should not process bindings inside x-fluff-component elements', () =>
    {
        class ParentComponent extends FluffElement
        {

            public value = 'test';

            protected override __render(): void
            {
                this.__getShadowRoot().innerHTML = `
                    <span data-lid="l0">text</span>
                    <child-component x-fluff-component data-lid="l1">
                    </child-component>
                `;
            }

            protected override __setupBindings(): void
            {
                super.__setupBindings();
            }
        }

        if (!customElements.get('test-parent-skip2'))
        {
            customElements.define('test-parent-skip2', ParentComponent);
        }

        ParentComponent.__bindings = {
            l0: [{ n: 'textContent', b: 'property', e: 0 }],
            l1: [{ n: 'item', b: 'property', e: 0 }]
        };

        const parent = document.createElement('test-parent-skip2');
        if (!(parent instanceof ParentComponent))
        {
            throw new Error('Expected ParentComponent');
        }
        document.body.appendChild(parent);

        const span = parent.shadowRoot?.querySelector('span');
        expect(span?.textContent)
            .toBe('test');

        parent.remove();
    });
});
