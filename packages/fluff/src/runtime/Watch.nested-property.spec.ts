import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Property } from '../utils/Property.js';
import { FluffBase } from './FluffBase.js';
import {
    resetTestWatchNestedPropertyState,
    testWatchNestedPropertyCallCount,
    TestWatchNestedPropertyChildComponent,
    testWatchNestedPropertyLastValue
} from './tests/TestWatchNestedPropertyChildComponent.js';
import { TestWatchNestedPropertyChildComponent2 } from './tests/TestWatchNestedPropertyChildComponent2.js';
import { TestWatchNestedPropertyContainerClass } from './tests/TestWatchNestedPropertyContainerClass.js';
import { TestWatchNestedPropertyParentComponent } from './tests/TestWatchNestedPropertyParentComponent.js';
import { TestWatchNestedPropertyParentComponent2 } from './tests/TestWatchNestedPropertyParentComponent2.js';

describe('Watch with nested Property bindings', () =>
{
    beforeEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
        resetTestWatchNestedPropertyState();
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it('should trigger @Watch when parent nested Property value changes', async() =>
    {
        FluffBase.__e = [
            (t: unknown): Property<number> =>
            {
                if (t instanceof TestWatchNestedPropertyParentComponent)
                {
                    return t.hostClass.childProp;
                }
                throw new Error('Invalid type');
            }
        ];

        Reflect.set(TestWatchNestedPropertyParentComponent, '__bindings', {
            l0: [{ n: 'property', b: 'property', d: [['hostClass', 'childProp']], e: 0 }]
        });

        const childTag = 'test-watch-nested-child-' + Math.random()
            .toString(36)
            .slice(2);
        const parentTag = 'test-watch-nested-parent-' + Math.random()
            .toString(36)
            .slice(2);

        customElements.define(childTag, TestWatchNestedPropertyChildComponent);
        customElements.define(parentTag, TestWatchNestedPropertyParentComponent);

        Reflect.set(TestWatchNestedPropertyParentComponent.prototype, '__render', function(this: TestWatchNestedPropertyParentComponent): void
        {
            this.__getShadowRoot().innerHTML = `<${childTag} data-lid="l0"></${childTag}>`;
        });

        const parent = document.createElement(parentTag);
        if (!(parent instanceof TestWatchNestedPropertyParentComponent))
        {
            throw new Error('Expected TestWatchNestedPropertyParentComponent');
        }
        document.body.appendChild(parent);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const initialCallCount = testWatchNestedPropertyCallCount;

        parent.hostClass.childProp.setValue(42);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        expect(testWatchNestedPropertyCallCount)
            .toBe(initialCallCount + 1);
        expect(testWatchNestedPropertyLastValue)
            .toBe(42);

        parent.remove();
    });

    it('should unsubscribe from old nested Property and resubscribe to new one when parent changes', async() =>
    {
        FluffBase.__e = [
            (t: unknown): Property<number> =>
            {
                if (t instanceof TestWatchNestedPropertyParentComponent2)
                {
                    return t.hostClass.childProp;
                }
                throw new Error('Invalid type');
            }
        ];

        Reflect.set(TestWatchNestedPropertyParentComponent2, '__bindings', {
            l0: [{ n: 'property', b: 'property', d: [['hostClass', 'childProp']], e: 0 }]
        });

        const childTag = 'test-watch-nested-resub-child-' + Math.random()
            .toString(36)
            .slice(2);
        const parentTag = 'test-watch-nested-resub-parent-' + Math.random()
            .toString(36)
            .slice(2);

        customElements.define(childTag, TestWatchNestedPropertyChildComponent2);
        customElements.define(parentTag, TestWatchNestedPropertyParentComponent2);

        Reflect.set(TestWatchNestedPropertyParentComponent2.prototype, '__render', function(this: TestWatchNestedPropertyParentComponent2): void
        {
            this.__getShadowRoot().innerHTML = `<${childTag} data-lid="l0"></${childTag}>`;
        });

        const parent = document.createElement(parentTag);
        if (!(parent instanceof TestWatchNestedPropertyParentComponent))
        {
            throw new Error('Expected TestWatchNestedPropertyParentComponent');
        }
        document.body.appendChild(parent);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const oldContainer = parent.hostClass;
        const oldChildProp = oldContainer.childProp;

        const newContainer = new TestWatchNestedPropertyContainerClass();
        newContainer.childProp.setValue(100);

        parent.hostClass = newContainer;

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        expect(testWatchNestedPropertyLastValue)
            .toBe(100);

        const countAfterSwap = testWatchNestedPropertyCallCount;

        oldChildProp.setValue(999);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        expect(testWatchNestedPropertyCallCount)
            .toBe(countAfterSwap);
        expect(testWatchNestedPropertyLastValue)
            .toBe(100);

        newContainer.childProp.setValue(200);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        expect(testWatchNestedPropertyCallCount)
            .toBe(countAfterSwap + 1);
        expect(testWatchNestedPropertyLastValue)
            .toBe(200);

        parent.remove();
    });
});
