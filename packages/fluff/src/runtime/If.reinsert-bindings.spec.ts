import { describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { TestIfReinsertBindsInputChildComponent } from './tests/TestIfReinsertBindsInputChildComponent.js';
import { TestIfReinsertBindsInputParentComponent } from './tests/TestIfReinsertBindsInputParentComponent.js';
import { TestIfUnsubscribeNestedParentComponent } from './tests/TestIfUnsubscribeNestedParentComponent.js';
import { TestUnsubscribeNestedChildComponent } from './tests/TestUnsubscribeNestedChildComponent.js';
import { TestUnsubscribeNestedGrandchildComponent } from './tests/TestUnsubscribeNestedGrandchildComponent.js';

describe('if reinsert bindings', () =>
{
    it('should re-apply input bindings when a component is removed and re-inserted by @if', async() =>
    {
        FluffBase.__e = [
            (t: TestIfReinsertBindsInputParentComponent): boolean => t.show,
            (t: TestIfReinsertBindsInputParentComponent): unknown => t.stats,
            (t: TestIfReinsertBindsInputChildComponent): number => t.stats.total
        ];
        FluffBase.__h = [];

        if (!customElements.get('test-if-reinsert-binds-input-parent'))
        {
            customElements.define('test-if-reinsert-binds-input-parent', TestIfReinsertBindsInputParentComponent);
        }
        if (!customElements.get('test-if-reinsert-binds-input-child'))
        {
            customElements.define('test-if-reinsert-binds-input-child', TestIfReinsertBindsInputChildComponent);
        }

        const el = document.createElement('test-if-reinsert-binds-input-parent');
        if (!(el instanceof TestIfReinsertBindsInputParentComponent))
        {
            throw new Error('Expected TestIfReinsertBindsInputParentComponent');
        }
        document.body.appendChild(el);
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

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
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        el.show = true;
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        expect(getText())
            .toBe('8');

        el.remove();
    });

    it('should unsubscribe bindings on removal for nested components inserted by @if', async() =>
    {
        FluffBase.__e = [];
        FluffBase.__e[0] = (t: TestIfUnsubscribeNestedParentComponent): boolean => t.show;
        FluffBase.__e[1] = (t: TestIfUnsubscribeNestedParentComponent): unknown => t.stats;
        FluffBase.__e[4] = (t: TestUnsubscribeNestedChildComponent): unknown => t.stats;
        FluffBase.__e[5] = (t: TestUnsubscribeNestedGrandchildComponent): number => t.stats.total;
        FluffBase.__h = [];

        if (!customElements.get('test-if-unsubscribe-nested-parent'))
        {
            customElements.define('test-if-unsubscribe-nested-parent', TestIfUnsubscribeNestedParentComponent);
        }
        if (!customElements.get('test-unsubscribe-nested-child'))
        {
            customElements.define('test-unsubscribe-nested-child', TestUnsubscribeNestedChildComponent);
        }
        if (!customElements.get('test-unsubscribe-nested-grandchild'))
        {
            customElements.define('test-unsubscribe-nested-grandchild', TestUnsubscribeNestedGrandchildComponent);
        }

        const el = document.createElement('test-if-unsubscribe-nested-parent');
        if (!(el instanceof TestIfUnsubscribeNestedParentComponent))
        {
            throw new Error('Expected TestIfUnsubscribeNestedParentComponent');
        }
        document.body.appendChild(el);
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        const child = el.shadowRoot?.querySelector('test-unsubscribe-nested-child');
        if (!(child instanceof TestUnsubscribeNestedChildComponent))
        {
            throw new Error('Expected TestUnsubscribeNestedChildComponent');
        }
        const initialSetCount = child.statsSetCount;

        el.show = false;
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        el.setStatsTotal(9);
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        expect(child.statsSetCount)
            .toBe(initialSetCount);

        el.remove();
    });
});
