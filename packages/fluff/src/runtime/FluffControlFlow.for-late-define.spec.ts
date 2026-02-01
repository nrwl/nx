import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { TestLateDefineForChildComponent } from './tests/TestLateDefineForChildComponent.js';
import { type TestLateDefineForColumn, TestLateDefineForComponent } from './tests/TestLateDefineForComponent.js';

describe('fluff:for (late custom element define)', () =>
{
    beforeEach(() =>
    {
        FluffBase.__e = [
            (t: TestLateDefineForComponent): TestLateDefineForColumn[] => t.columns,
            (_t: TestLateDefineForComponent, l: {
                column: TestLateDefineForColumn
            }): TestLateDefineForColumn => l.column
        ];
        FluffBase.__h = [];
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it('should apply per-iteration property bindings even if child custom element is defined later', async() =>
    {
        TestLateDefineForComponent.__bindings = {
            l0: [{ n: 'column', b: 'property', e: 1 }]
        };

        if (!customElements.get('late-define-for-component'))
        {
            customElements.define('late-define-for-component', TestLateDefineForComponent);
        }

        const component = document.createElement('late-define-for-component');
        if (!(component instanceof TestLateDefineForComponent))
        {
            throw new Error('Expected TestLateDefineForComponent');
        }

        document.body.appendChild(component);

        if (!customElements.get('late-define-for-child'))
        {
            customElements.define('late-define-for-child', TestLateDefineForChildComponent);
        }

        const nodes = Array.from(component.shadowRoot?.querySelectorAll('late-define-for-child') ?? []);
        for (const node of nodes)
        {
            customElements.upgrade(node);
        }

        await Promise.resolve();

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
