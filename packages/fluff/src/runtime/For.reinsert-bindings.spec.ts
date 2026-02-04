import { describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { TestForReinsertBindsInputParentComponent } from './tests/TestForReinsertBindsInputParentComponent.js';
import { TestForUnsubscribeNestedParentComponent } from './tests/TestForUnsubscribeNestedParentComponent.js';
import { TestIfReinsertBindsInputChildComponent } from './tests/TestIfReinsertBindsInputChildComponent.js';
import { TestUnsubscribeNestedChildComponent } from './tests/TestUnsubscribeNestedChildComponent.js';
import { TestUnsubscribeNestedGrandchildComponent } from './tests/TestUnsubscribeNestedGrandchildComponent.js';

describe('for reinsert bindings', () =>
{
    it('should apply input bindings when a component is inserted and re-inserted by @for', async() =>
    {
        FluffBase.__e = [
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
        ];
        FluffBase.__h = [];

        if (!customElements.get('test-for-reinsert-binds-input-parent'))
        {
            customElements.define('test-for-reinsert-binds-input-parent', TestForReinsertBindsInputParentComponent);
        }
        if (!customElements.get('test-if-reinsert-binds-input-child'))
        {
            customElements.define('test-if-reinsert-binds-input-child', TestIfReinsertBindsInputChildComponent);
        }

        const el = document.createElement('test-for-reinsert-binds-input-parent');
        if (!(el instanceof TestForReinsertBindsInputParentComponent))
        {
            throw new Error('Expected TestForReinsertBindsInputParentComponent');
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

        el.items = [];
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        expect(getText())
            .toBe('');

        el.items = [1];
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        expect(getText())
            .toBe('8');

        el.remove();
    });

    it('should unsubscribe bindings on removal for nested components inserted by @for', async() =>
    {
        FluffBase.__e = [];
        FluffBase.__e[0] = (t: unknown): number[] =>
        {
            if (t instanceof TestForUnsubscribeNestedParentComponent)
            {
                return t.items;
            }
            throw new Error('Invalid type');
        };
        FluffBase.__e[1] = (t: unknown): unknown =>
        {
            if (t instanceof TestForUnsubscribeNestedParentComponent)
            {
                return t.stats;
            }
            throw new Error('Invalid type');
        };
        FluffBase.__e[4] = (t: unknown): unknown =>
        {
            if (t instanceof TestUnsubscribeNestedChildComponent)
            {
                return t.stats;
            }
            throw new Error('Invalid type');
        };
        FluffBase.__e[5] = (t: unknown): number =>
        {
            if (t instanceof TestUnsubscribeNestedGrandchildComponent)
            {
                return t.stats.total;
            }
            throw new Error('Invalid type');
        };
        FluffBase.__h = [];

        if (!customElements.get('test-for-unsubscribe-nested-parent'))
        {
            customElements.define('test-for-unsubscribe-nested-parent', TestForUnsubscribeNestedParentComponent);
        }
        if (!customElements.get('test-unsubscribe-nested-child'))
        {
            customElements.define('test-unsubscribe-nested-child', TestUnsubscribeNestedChildComponent);
        }
        if (!customElements.get('test-unsubscribe-nested-grandchild'))
        {
            customElements.define('test-unsubscribe-nested-grandchild', TestUnsubscribeNestedGrandchildComponent);
        }

        const el = document.createElement('test-for-unsubscribe-nested-parent');
        if (!(el instanceof TestForUnsubscribeNestedParentComponent))
        {
            throw new Error('Expected TestForUnsubscribeNestedParentComponent');
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

        el.items = [];
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
