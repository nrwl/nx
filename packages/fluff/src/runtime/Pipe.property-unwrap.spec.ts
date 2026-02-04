import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Property } from '../utils/Property.js';
import { FluffBase } from './FluffBase.js';
import { createPipeUnwrapChildComponent } from './tests/createPipeUnwrapChildComponent.js';
import type { PipeUnwrapTestState } from './tests/createPipeUnwrapParentComponent.js';
import { createPipeUnwrapParentComponent } from './tests/createPipeUnwrapParentComponent.js';
import { createPipeUnwrapTestComponent } from './tests/createPipeUnwrapTestComponent.js';

function hasTestProp(t: unknown): t is { __testProp: Property<number> }
{
    return typeof t === 'object' && t !== null && '__testProp' in t;
}

describe('Pipe property unwrapping', () =>
{
    const state: PipeUnwrapTestState = {
        receivedValue: null,
        receivedValueType: ''
    };

    beforeEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
        state.receivedValue = null;
        state.receivedValueType = '';
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it('should unwrap Property instance before passing to pipe in interpolation', async() =>
    {
        const tag = 'test-pipe-unwrap-' + Math.random().toString(36).slice(2);

        const TestComponent = createPipeUnwrapTestComponent(state);

        FluffBase.__e = [
            (t: unknown): Property<number> =>
            {
                if (hasTestProp(t))
                {
                    return t.__testProp;
                }
                throw new Error('Invalid type');
            }
        ];

        customElements.define(tag, TestComponent);

        const el = document.createElement(tag);
        document.body.appendChild(el);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        expect(state.receivedValueType).toBe('number');
        expect(state.receivedValue).toBe(42);

        el.remove();
    });

    it('should unwrap Property instance in property binding before passing to pipe', async() =>
    {
        const parentTag = 'test-pipe-unwrap-parent-' + Math.random().toString(36).slice(2);
        const childTag = 'test-pipe-unwrap-child-' + Math.random().toString(36).slice(2);

        const ChildComponent = createPipeUnwrapChildComponent();
        const ParentComponent = createPipeUnwrapParentComponent(state, childTag);

        FluffBase.__e = [
            (t: unknown): Property<number> =>
            {
                if (hasTestProp(t))
                {
                    return t.__testProp;
                }
                throw new Error('Invalid type');
            }
        ];

        Reflect.set(ParentComponent, '__bindings', {
            l0: [
                {
                    n: 'value',
                    b: 'property',
                    d: ['testProp'],
                    e: 0,
                    p: [{ n: 'capture', a: [] }]
                }
            ]
        });

        customElements.define(childTag, ChildComponent);
        customElements.define(parentTag, ParentComponent);

        const parent = document.createElement(parentTag);
        document.body.appendChild(parent);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        expect(state.receivedValueType).toBe('number');
        expect(state.receivedValue).toBe(99);

        parent.remove();
    });
});
