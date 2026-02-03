import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { TestDirectChildComponent } from './tests/TestDirectChildComponent.js';
import { TestDirectParentComponent } from './tests/TestDirectParentComponent.js';

describe('bindings on direct custom element children', () =>
{
    beforeEach(() =>
    {
        FluffBase.__e = [
            (t: { itemName: string }): string => t.itemName
        ];
        FluffBase.__h = [];
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it('should apply parent bindings to direct custom element children', async() =>
    {
        Reflect.set(TestDirectParentComponent, '__bindings', {
            l0: [{ n: 'value', b: 'property', d: ['itemName'], e: 0 }]
        });

        const parentTag = 'test-direct-parent-' + Math.random().toString(36).slice(2);
        const childTag = 'test-direct-child';

        if (!customElements.get(childTag))
        {
            customElements.define(childTag, TestDirectChildComponent);
        }
        customElements.define(parentTag, TestDirectParentComponent);

        const parent = document.createElement(parentTag);
        document.body.appendChild(parent);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const child = parent.shadowRoot?.querySelector(childTag);
        expect(child).toBeInstanceOf(TestDirectChildComponent);

        if (!(child instanceof TestDirectChildComponent))
        {
            throw new Error('Expected TestDirectChildComponent');
        }
        expect(child.value).toBe('test-item');

        parent.remove();
    });
});
