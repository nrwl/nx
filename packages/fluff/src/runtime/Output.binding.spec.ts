import { describe, expect, it } from 'vitest';
import { TestOutputBindingChildComponent } from './tests/TestOutputBindingChildComponent.js';
import { TestOutputBindingParentComponent } from './tests/TestOutputBindingParentComponent.js';
import { hasTaskId } from './tests/typeguards.js';
import { TestHarness } from './tests/TestHarness.js';

describe('output bindings', () =>
{
    it('should invoke parent handler when child output emits', async() =>
    {
        TestHarness.setExpressionTable([
            (t: unknown): boolean =>
            {
                if (t instanceof TestOutputBindingParentComponent)
                {
                    return t.show;
                }
                throw new Error('Invalid type');
            }
        ], [
            (t: unknown, _l: Record<string, unknown>, e: unknown): void =>
            {
                if (t instanceof TestOutputBindingParentComponent && hasTaskId(e))
                {
                    t.onChildEdit(e);
                    return;
                }
                throw new Error('Invalid type');
            },
            (t: unknown): void =>
            {
                if (t instanceof TestOutputBindingChildComponent)
                {
                    t.onEdit();
                    return;
                }
                throw new Error('Invalid type');
            }
        ]);

        TestHarness.defineCustomElement('test-output-binding-parent', TestOutputBindingParentComponent);
        TestHarness.defineCustomElement('test-output-binding-child', TestOutputBindingChildComponent);

        const el = TestHarness.mount('test-output-binding-parent');
        if (!(el instanceof TestOutputBindingParentComponent))
        {
            throw new Error('Expected TestOutputBindingParentComponent');
        }
        await TestHarness.tick(6);

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
        await TestHarness.tick(6);

        expect(el.editCount)
            .toBe(1);
        expect(el.lastTaskId)
            .toBe(42);

        el.remove();
    });
});
