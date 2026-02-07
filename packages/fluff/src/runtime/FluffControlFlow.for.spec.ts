import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestForChildComponent } from './tests/TestForChildComponent.js';
import { TestForComponent } from './tests/TestForComponent.js';
import { TestHarness } from './tests/TestHarness.js';

describe('fluff:for', () =>
{
    beforeEach(() =>
    {
        TestHarness.setExpressionTable([
            (t: unknown): string[] =>
            {
                if (t instanceof TestForComponent)
                {
                    return t.items;
                }
                throw new Error('Invalid type');
            },
            (_t: unknown, l: Record<string, unknown>): unknown => l.item
        ], []);
    });

    afterEach(() =>
    {
        TestHarness.resetExpressionTable();
    });

    it('should bind each loop item to a child component', () =>
    {
        TestHarness.defineCustomElement('test-for-child', TestForChildComponent);

        TestForComponent.__bindings = {
            l0: [{ n: 'value', b: 'property', e: 1 }]
        };

        TestHarness.defineCustomElement('test-for-component', TestForComponent);

        const component = TestHarness.mount('test-for-component');
        if (!(component instanceof TestForComponent))
        {
            throw new Error('Expected TestForComponent');
        }

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
