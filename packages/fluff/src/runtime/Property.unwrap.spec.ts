import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Property } from '../utils/Property.js';
import { FluffBase } from './FluffBase.js';
import {
    resetTestPropertyUnwrapReceivedValue,
    TestPropertyUnwrapChildComponent,
    testPropertyUnwrapReceivedValue
} from './tests/TestPropertyUnwrapChildComponent.js';
import { TestPropertyUnwrapParentComponent } from './tests/TestPropertyUnwrapParentComponent.js';

describe('Property unwrapping in bindings', () =>
{
    beforeEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
        resetTestPropertyUnwrapReceivedValue();
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it.skip('should unwrap Property values when passing to child component input', async() =>
    {
        FluffBase.__e = [
            (t: unknown): Property<number> =>
            {
                if (t instanceof TestPropertyUnwrapParentComponent)
                {
                    return t.hostClass.childProp;
                }
                throw new Error('Invalid type');
            }
        ];

        Reflect.set(TestPropertyUnwrapParentComponent, '__bindings', {
            l0: [{ n: 'property', b: 'property', d: [['hostClass', 'childProp']], e: 0 }]
        });

        const childTag = 'test-prop-unwrap-child-' + Math.random()
            .toString(36)
            .slice(2);
        const parentTag = 'test-prop-unwrap-parent-' + Math.random()
            .toString(36)
            .slice(2);

        customElements.define(childTag, TestPropertyUnwrapChildComponent);
        customElements.define(parentTag, TestPropertyUnwrapParentComponent);

        Reflect.set(TestPropertyUnwrapParentComponent.prototype, '__render', function(this: TestPropertyUnwrapParentComponent): void
        {
            this.__getShadowRoot().innerHTML = `<${childTag} data-lid="l0"></${childTag}>`;
        });

        const parent = document.createElement(parentTag);
        document.body.appendChild(parent);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        expect(testPropertyUnwrapReceivedValue)
            .toBe(42);
        expect(testPropertyUnwrapReceivedValue)
            .not
            .toBeInstanceOf(Property);

        parent.remove();
    });
});
