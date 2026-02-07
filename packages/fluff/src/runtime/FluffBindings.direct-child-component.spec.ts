import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestDirectChildComponent } from './tests/TestDirectChildComponent.js';
import { TestDirectParentComponent } from './tests/TestDirectParentComponent.js';
import { hasItemName } from './tests/typeguards.js';
import { TestHarness } from './tests/TestHarness.js';

describe('bindings on direct custom element children', () =>
{
    beforeEach(() =>
    {
        TestHarness.setExpressionTable([
            (t: unknown): string =>
            {
                if (hasItemName(t))
                {
                    return t.itemName;
                }
                throw new Error('Invalid type');
            }
        ], []);
    });

    afterEach(() =>
    {
        TestHarness.resetExpressionTable();
    });

    it('should apply parent bindings to direct custom element children', async() =>
    {
        Reflect.set(TestDirectParentComponent, '__bindings', {
            l0: [{ n: 'value', b: 'property', d: ['itemName'], e: 0 }]
        });

        const parentTag = 'test-direct-parent-' + Math.random()
            .toString(36)
            .slice(2);
        const childTag = 'test-direct-child';

        TestHarness.defineCustomElement(childTag, TestDirectChildComponent);
        TestHarness.defineCustomElement(parentTag, TestDirectParentComponent);

        const parent = TestHarness.mount(parentTag);

        await TestHarness.waitForTimeout();

        const child = parent.shadowRoot?.querySelector(childTag);
        expect(child)
            .toBeInstanceOf(TestDirectChildComponent);

        if (!(child instanceof TestDirectChildComponent))
        {
            throw new Error('Expected TestDirectChildComponent');
        }
        expect(child.value)
            .toBe('test-item');

        parent.remove();
    });
});
