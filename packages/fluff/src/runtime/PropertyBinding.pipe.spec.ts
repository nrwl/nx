import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { createChildComponent } from './tests/createPropertyBindingPipeChildComponent.js';
import { createParentComponent } from './tests/createPropertyBindingPipeParentComponent.js';
import {
    resetTestPropertyBindingPipeReceivedValue,
    TestPropertyBindingPipeChildComponent,
    testPropertyBindingPipeReceivedValue
} from './tests/TestPropertyBindingPipeChildComponent.js';
import { TestPropertyBindingPipeParentComponent } from './tests/TestPropertyBindingPipeParentComponent.js';

describe('Property binding with pipes', () =>
{
    beforeEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
        resetTestPropertyBindingPipeReceivedValue();
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it('should apply pipe to property binding value', async() =>
    {
        FluffBase.__e = [
            (t: unknown): number =>
            {
                if (t instanceof TestPropertyBindingPipeParentComponent)
                {
                    return t.amount;
                }
                throw new Error('Invalid type');
            }
        ];

        Reflect.set(TestPropertyBindingPipeParentComponent, '__bindings', {
            l0: [
                {
                    n: 'value',
                    b: 'property',
                    d: ['amount'],
                    e: 0,
                    p: [{ n: 'double', a: [] }]
                }
            ]
        });

        const childTag = 'test-prop-binding-pipe-child-' + Math.random()
            .toString(36)
            .slice(2);
        const parentTag = 'test-prop-binding-pipe-parent-' + Math.random()
            .toString(36)
            .slice(2);

        customElements.define(childTag, TestPropertyBindingPipeChildComponent);
        customElements.define(parentTag, TestPropertyBindingPipeParentComponent);

        Reflect.set(TestPropertyBindingPipeParentComponent.prototype, '__render', function(this: TestPropertyBindingPipeParentComponent): void
        {
            this.__getShadowRoot().innerHTML = `<${childTag} data-lid="l0"></${childTag}>`;
        });

        const parent = document.createElement(parentTag);
        document.body.appendChild(parent);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        expect(testPropertyBindingPipeReceivedValue)
            .toBe(200);

        parent.remove();
    });

    it('should apply pipe with arguments to property binding value', async() =>
    {
        FluffBase.__e = [
            (t: unknown): number =>
            {
                if (t instanceof TestPropertyBindingPipeParentComponent)
                {
                    return t.amount;
                }
                throw new Error('Invalid type');
            },
            (): string => '!'
        ];

        const childTag = 'test-prop-binding-pipe-args-child-' + Math.random()
            .toString(36)
            .slice(2);
        const parentTag = 'test-prop-binding-pipe-args-parent-' + Math.random()
            .toString(36)
            .slice(2);

        const ChildComponent = createChildComponent();
        const ParentComponent = createParentComponent();

        Reflect.set(ParentComponent, '__bindings', {
            l0: [
                {
                    n: 'value',
                    b: 'property',
                    d: ['amount'],
                    e: 0,
                    p: [{ n: 'addSuffix', a: [1] }]
                }
            ]
        });

        customElements.define(childTag, ChildComponent);
        customElements.define(parentTag, ParentComponent);

        Reflect.set(TestPropertyBindingPipeParentComponent.prototype, '__render', function(this: TestPropertyBindingPipeParentComponent): void
        {
            this.__getShadowRoot().innerHTML = `<${childTag} data-lid="l0"></${childTag}>`;
        });

        const parent = document.createElement(parentTag);
        document.body.appendChild(parent);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        expect(testPropertyBindingPipeReceivedValue)
            .toBe('100!');

        parent.remove();
    });
});
