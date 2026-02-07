import { describe, expect, it } from 'vitest';
import { TestForReinsertBindsInputParentComponent } from './tests/TestForReinsertBindsInputParentComponent.js';
import { TestForUnsubscribeNestedParentComponent } from './tests/TestForUnsubscribeNestedParentComponent.js';
import { TestIfReinsertBindsInputChildComponent } from './tests/TestIfReinsertBindsInputChildComponent.js';
import { TestUnsubscribeNestedChildComponent } from './tests/TestUnsubscribeNestedChildComponent.js';
import { TestUnsubscribeNestedGrandchildComponent } from './tests/TestUnsubscribeNestedGrandchildComponent.js';
import { TestHarness } from './tests/TestHarness.js';

describe('for reinsert bindings', () =>
{
    it('should apply input bindings when a component is inserted and re-inserted by @for', async() =>
    {
        TestHarness.setExpressionTable([
            (t: unknown): number[] =>
            {
                if (t instanceof TestForReinsertBindsInputParentComponent)
                {
                    return t.items;
                }
                throw new Error('Invalid type');
            },
            (t: unknown): unknown =>
            {
                if (t instanceof TestForReinsertBindsInputParentComponent)
                {
                    return t.stats;
                }
                throw new Error('Invalid type');
            },
            (t: unknown): number =>
            {
                if (t instanceof TestIfReinsertBindsInputChildComponent)
                {
                    return t.stats.total;
                }
                throw new Error('Invalid type');
            }
        ], []);

        TestHarness.defineCustomElement('test-for-reinsert-binds-input-parent', TestForReinsertBindsInputParentComponent);
        TestHarness.defineCustomElement('test-if-reinsert-binds-input-child', TestIfReinsertBindsInputChildComponent);

        const el = TestHarness.mount('test-for-reinsert-binds-input-parent');
        if (!(el instanceof TestForReinsertBindsInputParentComponent))
        {
            throw new Error('Expected TestForReinsertBindsInputParentComponent');
        }
        await TestHarness.tick(6);

        const getText = (): string =>
        {
            const node = el.shadowRoot?.querySelector('test-if-reinsert-binds-input-child');
            if (!(node instanceof TestIfReinsertBindsInputChildComponent))
            {
                return '';
            }

            const text = node.shadowRoot?.querySelector('.total')?.textContent;
            if (typeof text !== 'string')
            {
                return '';
            }
            return text.trim();
        };

        expect(getText())
            .toBe('8');

        el.items = [];
        await TestHarness.tick(6);

        expect(getText())
            .toBe('');

        el.items = [1];
        await TestHarness.tick(6);

        expect(getText())
            .toBe('8');

        el.remove();
    });

    it('should unsubscribe bindings on removal for nested components inserted by @for', async() =>
    {
        const expressions: ((t: unknown, l: Record<string, unknown>) => unknown)[] = [];
        expressions[0] = (t: unknown): number[] =>
        {
            if (t instanceof TestForUnsubscribeNestedParentComponent)
            {
                return t.items;
            }
            throw new Error('Invalid type');
        };
        expressions[1] = (t: unknown): unknown =>
        {
            if (t instanceof TestForUnsubscribeNestedParentComponent)
            {
                return t.stats;
            }
            throw new Error('Invalid type');
        };
        expressions[4] = (t: unknown): unknown =>
        {
            if (t instanceof TestUnsubscribeNestedChildComponent)
            {
                return t.stats;
            }
            throw new Error('Invalid type');
        };
        expressions[5] = (t: unknown): number =>
        {
            if (t instanceof TestUnsubscribeNestedGrandchildComponent)
            {
                return t.stats.total;
            }
            throw new Error('Invalid type');
        };
        TestHarness.setExpressionTable(expressions, []);

        TestHarness.defineCustomElement('test-for-unsubscribe-nested-parent', TestForUnsubscribeNestedParentComponent);
        TestHarness.defineCustomElement('test-unsubscribe-nested-child', TestUnsubscribeNestedChildComponent);
        TestHarness.defineCustomElement('test-unsubscribe-nested-grandchild', TestUnsubscribeNestedGrandchildComponent);

        const el = TestHarness.mount('test-for-unsubscribe-nested-parent');
        if (!(el instanceof TestForUnsubscribeNestedParentComponent))
        {
            throw new Error('Expected TestForUnsubscribeNestedParentComponent');
        }
        await TestHarness.tick(6);

        const child = el.shadowRoot?.querySelector('test-unsubscribe-nested-child');
        if (!(child instanceof TestUnsubscribeNestedChildComponent))
        {
            throw new Error('Expected TestUnsubscribeNestedChildComponent');
        }
        const initialSetCount = child.statsSetCount;

        el.items = [];
        await TestHarness.tick(6);

        el.setStatsTotal(9);
        await TestHarness.tick(6);

        expect(child.statsSetCount)
            .toBe(initialSetCount);

        el.remove();
    });
});
