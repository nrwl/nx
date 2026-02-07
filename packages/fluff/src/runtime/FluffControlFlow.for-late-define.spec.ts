import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestLateDefineForChildComponent } from './tests/TestLateDefineForChildComponent.js';
import { type TestLateDefineForColumn, TestLateDefineForComponent } from './tests/TestLateDefineForComponent.js';
import { isLateDefineForColumn } from './tests/typeguards.js';
import { TestHarness } from './tests/TestHarness.js';

describe('fluff:for (late custom element define)', () =>
{
    beforeEach(() =>
    {
        TestHarness.setExpressionTable([
            (t: unknown): TestLateDefineForColumn[] =>
            {
                if (t instanceof TestLateDefineForComponent)
                {
                    return t.columns;
                }
                throw new Error('Invalid type');
            },
            (_t: unknown, l: Record<string, unknown>): TestLateDefineForColumn =>
            {
                if (isLateDefineForColumn(l))
                {
                    return l.column;
                }
                throw new Error('Invalid type');
            }
        ], []);
    });

    afterEach(() =>
    {
        TestHarness.resetExpressionTable();
    });

    it('should apply per-iteration property bindings even if child custom element is defined later', async() =>
    {
        TestLateDefineForComponent.__bindings = {
            l0: [{ n: 'column', b: 'property', e: 1 }]
        };

        TestHarness.defineCustomElement('late-define-for-component', TestLateDefineForComponent);

        const component = TestHarness.mount('late-define-for-component');
        if (!(component instanceof TestLateDefineForComponent))
        {
            throw new Error('Expected TestLateDefineForComponent');
        }
        TestHarness.defineCustomElement('late-define-for-child', TestLateDefineForChildComponent);

        const nodes = Array.from(component.shadowRoot?.querySelectorAll('late-define-for-child') ?? []);
        for (const node of nodes)
        {
            customElements.upgrade(node);
        }

        await TestHarness.tick();

        const children = Array.from(component.shadowRoot?.querySelectorAll('late-define-for-child') ?? []);
        const values = children.map((child) =>
        {
            if (!(child instanceof TestLateDefineForChildComponent))
            {
                throw new Error('Expected TestLateDefineForChildComponent');
            }
            return child.column;
        });

        expect(values)
            .toEqual(component.columns);

        component.remove();
    });
});
