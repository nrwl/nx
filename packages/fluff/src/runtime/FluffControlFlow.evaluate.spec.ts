import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { FluffElement } from './FluffElement.js';

describe('FluffElement compiled expr evaluation with loop context', () =>
{
    beforeEach(() =>
    {
        FluffBase.__e = [
            (_t: unknown, l: Record<string, unknown>): unknown => l.item
        ];
        FluffBase.__h = [];
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it('should evaluate loop variable when context is provided', () =>
    {
        class TestComponent extends FluffElement
        {

            protected override __render(): void
            {
                this.__getShadowRoot().innerHTML = '<span>test</span>';
            }

            protected override __setupBindings(): void
            {
            }

            public evaluateExprById(exprId: number): unknown
            {
                const scope = this.__getScope();
                const fn = this.__getCompiledExprFn(exprId);
                return fn(this, scope.locals);
            }
        }

        if (!customElements.get('test-eval-component'))
        {
            customElements.define('test-eval-component', TestComponent);
        }

        const component = document.createElement('test-eval-component');
        if (!(component instanceof TestComponent))
        {
            throw new Error('Expected TestComponent');
        }
        document.body.appendChild(component);

        component.__loopContext = { item: 'test-value' };

        const result = component.evaluateExprById(0);

        expect(result)
            .toBe('test-value');

        component.remove();
    });
});
