import { describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { TestSwitchReinsertBindsInputChildComponent } from './tests/TestSwitchReinsertBindsInputChildComponent.js';
import { TestSwitchReinsertBindsInputParentComponent } from './tests/TestSwitchReinsertBindsInputParentComponent.js';
import { TestSwitchUnsubscribeNestedParentComponent } from './tests/TestSwitchUnsubscribeNestedParentComponent.js';
import { TestUnsubscribeNestedChildComponent } from './tests/TestUnsubscribeNestedChildComponent.js';
import { TestUnsubscribeNestedGrandchildComponent } from './tests/TestUnsubscribeNestedGrandchildComponent.js';

describe('switch reinsert bindings', () =>
{
    it('should re-apply input bindings when a component is removed and re-inserted by @switch', async() =>
    {
        FluffBase.__e = [
            (t: unknown): string =>
            {
                if (t instanceof TestSwitchReinsertBindsInputParentComponent)
                {
                    return t.mode;
                }
                throw new Error('Invalid type');
            },
            (): string => 'a',
            (): string => 'b',
            (t: unknown): unknown =>
            {
                if (t instanceof TestSwitchReinsertBindsInputParentComponent)
                {
                    return t.stats;
                }
                throw new Error('Invalid type');
            },
            (t: unknown): number =>
            {
                if (t instanceof TestSwitchReinsertBindsInputChildComponent)
                {
                    return t.stats.total;
                }
                throw new Error('Invalid type');
            }
        ];
        FluffBase.__h = [];

        if (!customElements.get('test-switch-reinsert-binds-input-parent'))
        {
            customElements.define('test-switch-reinsert-binds-input-parent', TestSwitchReinsertBindsInputParentComponent);
        }
        if (!customElements.get('test-switch-reinsert-binds-input-child'))
        {
            customElements.define('test-switch-reinsert-binds-input-child', TestSwitchReinsertBindsInputChildComponent);
        }

        const el = document.createElement('test-switch-reinsert-binds-input-parent');
        if (!(el instanceof TestSwitchReinsertBindsInputParentComponent))
        {
            throw new Error('Expected TestSwitchReinsertBindsInputParentComponent');
        }
        document.body.appendChild(el);
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        const getText = (): string =>
        {
            const node = el.shadowRoot?.querySelector('test-switch-reinsert-binds-input-child');
            if (!(node instanceof TestSwitchReinsertBindsInputChildComponent))
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

        el.mode = 'b';
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        expect(getText())
            .toBe('8');

        el.mode = 'a';
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        expect(getText())
            .toBe('8');

        el.remove();
    });

    it('should unsubscribe bindings on removal for nested components inserted by @switch', async() =>
    {
        FluffBase.__e = [];
        FluffBase.__e[0] = (t: unknown): string =>
        {
            if (t instanceof TestSwitchUnsubscribeNestedParentComponent)
            {
                return t.mode;
            }
            throw new Error('Invalid type');
        };
        FluffBase.__e[1] = (): string => 'a';
        FluffBase.__e[2] = (): string => 'b';
        FluffBase.__e[3] = (t: unknown): unknown =>
        {
            if (t instanceof TestSwitchUnsubscribeNestedParentComponent)
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

        if (!customElements.get('test-switch-unsubscribe-nested-parent'))
        {
            customElements.define('test-switch-unsubscribe-nested-parent', TestSwitchUnsubscribeNestedParentComponent);
        }
        if (!customElements.get('test-unsubscribe-nested-child'))
        {
            customElements.define('test-unsubscribe-nested-child', TestUnsubscribeNestedChildComponent);
        }
        if (!customElements.get('test-unsubscribe-nested-grandchild'))
        {
            customElements.define('test-unsubscribe-nested-grandchild', TestUnsubscribeNestedGrandchildComponent);
        }

        const el = document.createElement('test-switch-unsubscribe-nested-parent');
        if (!(el instanceof TestSwitchUnsubscribeNestedParentComponent))
        {
            throw new Error('Expected TestSwitchUnsubscribeNestedParentComponent');
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

        el.mode = 'b';
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
