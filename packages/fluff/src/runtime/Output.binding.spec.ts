import { describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { TestOutputBindingChildComponent } from './tests/TestOutputBindingChildComponent.js';
import { TestOutputBindingParentComponent } from './tests/TestOutputBindingParentComponent.js';

describe('output bindings', () =>
{
    it('should invoke parent handler when child output emits', async() =>
    {
        FluffBase.__e = [
            (t: TestOutputBindingParentComponent): boolean => t.show
        ];
        FluffBase.__h = [];
        FluffBase.__h[0] = (t: TestOutputBindingParentComponent, _l: unknown, e: { taskId: number }): void =>
        {
            t.onChildEdit(e);
        };
        FluffBase.__h[1] = (t: TestOutputBindingChildComponent): void =>
        {
            t.onEdit();
        };

        if (!customElements.get('test-output-binding-parent'))
        {
            customElements.define('test-output-binding-parent', TestOutputBindingParentComponent);
        }
        if (!customElements.get('test-output-binding-child'))
        {
            customElements.define('test-output-binding-child', TestOutputBindingChildComponent);
        }

        const el = document.createElement('test-output-binding-parent');
        if (!(el instanceof TestOutputBindingParentComponent))
        {
            throw new Error('Expected TestOutputBindingParentComponent');
        }
        document.body.appendChild(el);
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        const child = el.shadowRoot?.querySelector('test-output-binding-child');
        if (!(child instanceof TestOutputBindingChildComponent))
        {
            throw new Error('Expected TestOutputBindingChildComponent');
        }

        const button = child.shadowRoot?.querySelector('button');
        if (!(button instanceof HTMLButtonElement))
        {
            throw new Error('Expected button');
        }

        button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        expect(el.editCount)
            .toBe(1);
        expect(el.lastTaskId)
            .toBe(42);

        el.remove();
    });
});
