import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { TestForChildComponent } from './tests/TestForChildComponent.js';
import { TestForComponent } from './tests/TestForComponent.js';

describe('fluff:for', () =>
{
    beforeEach(() =>
    {
        FluffBase.__e = [
            (t: unknown): string[] =>
            {
                if (t instanceof TestForComponent)
                {
                    return t.items;
                }
                throw new Error('Invalid type');
            },
            (_t: unknown, l: Record<string, unknown>): unknown => l.item
        ];
        FluffBase.__h = [];
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it('should bind each loop item to a child component', () =>
    {
        if (!customElements.get('test-for-child'))
        {
            customElements.define('test-for-child', TestForChildComponent);
        }

        TestForComponent.__bindings = {
            l0: [{ n: 'value', b: 'property', e: 1 }]
        };

        if (!customElements.get('test-for-component'))
        {
            customElements.define('test-for-component', TestForComponent);
        }

        const component = document.createElement('test-for-component');
        if (!(component instanceof TestForComponent))
        {
            throw new Error('Expected TestForComponent');
        }
        document.body.appendChild(component);

        const children = Array.from(component.shadowRoot?.querySelectorAll('test-for-child') ?? []);
        const values = children.map(child =>
        {
            if (!(child instanceof TestForChildComponent))
            {
                throw new Error('Expected TestForChildComponent');
            }
            return child.value;
        });

        expect(values)
            .toEqual(['a', 'b', 'c']);

        component.remove();
    });
});
