import { describe, expect, it } from 'vitest';
import { TestIfReinsertBindsInputChildComponent } from './tests/TestIfReinsertBindsInputChildComponent.js';
import { TestIfReinsertBindsInputParentComponent } from './tests/TestIfReinsertBindsInputParentComponent.js';
import { TestIfUnsubscribeNestedParentComponent } from './tests/TestIfUnsubscribeNestedParentComponent.js';
import { TestUnsubscribeNestedChildComponent } from './tests/TestUnsubscribeNestedChildComponent.js';
import { TestUnsubscribeNestedGrandchildComponent } from './tests/TestUnsubscribeNestedGrandchildComponent.js';
import { TestHarness } from './tests/TestHarness.js';

describe('if reinsert bindings', () =>
{
    it('should re-apply input bindings when a component is removed and re-inserted by @if', async() =>
    {
        TestHarness.setExpressionTable([
            (t: unknown): boolean =>
            {
                if (t instanceof TestIfReinsertBindsInputParentComponent)
                {
                    return t.show;
                }
                throw new Error('Invalid type');
            },
            (t: unknown): unknown =>
            {
                if (t instanceof TestIfReinsertBindsInputParentComponent)
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

        TestHarness.defineCustomElement('test-if-reinsert-binds-input-parent', TestIfReinsertBindsInputParentComponent);
        TestHarness.defineCustomElement('test-if-reinsert-binds-input-child', TestIfReinsertBindsInputChildComponent);

        const el = TestHarness.mount('test-if-reinsert-binds-input-parent');
        if (!(el instanceof TestIfReinsertBindsInputParentComponent))
        {
            throw new Error('Expected TestIfReinsertBindsInputParentComponent');
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

        el.show = false;
        await TestHarness.tick(6);

        el.show = true;
        await TestHarness.tick(6);

        expect(getText())
            .toBe('8');

        el.remove();
    });

    it('should unsubscribe bindings on removal for nested components inserted by @if', async() =>
    {
        const expressions: ((t: unknown, l: Record<string, unknown>) => unknown)[] = [];
        expressions[0] = (t: unknown): boolean =>
        {
            if (t instanceof TestIfUnsubscribeNestedParentComponent)
            {
                return t.show;
            }
            throw new Error('Invalid type');
        };
        expressions[1] = (t: unknown): unknown =>
        {
            if (t instanceof TestIfUnsubscribeNestedParentComponent)
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

        TestHarness.defineCustomElement('test-if-unsubscribe-nested-parent', TestIfUnsubscribeNestedParentComponent);
        TestHarness.defineCustomElement('test-unsubscribe-nested-child', TestUnsubscribeNestedChildComponent);
        TestHarness.defineCustomElement('test-unsubscribe-nested-grandchild', TestUnsubscribeNestedGrandchildComponent);

        const el = TestHarness.mount('test-if-unsubscribe-nested-parent');
        if (!(el instanceof TestIfUnsubscribeNestedParentComponent))
        {
            throw new Error('Expected TestIfUnsubscribeNestedParentComponent');
        }
        await TestHarness.tick(6);

        const child = el.shadowRoot?.querySelector('test-unsubscribe-nested-child');
        if (!(child instanceof TestUnsubscribeNestedChildComponent))
        {
            throw new Error('Expected TestUnsubscribeNestedChildComponent');
        }
        const initialSetCount = child.statsSetCount;

        el.show = false;
        await TestHarness.tick(6);

        el.setStatsTotal(9);
        await TestHarness.tick(6);

        expect(child.statsSetCount)
            .toBe(initialSetCount);

        el.remove();
    });
});
