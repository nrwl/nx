import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { TestGetterReactivityComponent } from './tests/TestGetterReactivityComponent.js';

describe('getter reactivity', () =>
{
    beforeEach(() =>
    {
        FluffBase.__e = [
            (t: TestGetterReactivityComponent): number => t.itemCount
        ];
        FluffBase.__h = [];
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it('should update when underlying reactive properties used by a getter change', async() =>
    {
        if (!customElements.get('test-getter-reactivity'))
        {
            customElements.define('test-getter-reactivity', TestGetterReactivityComponent);
        }

        const el = document.createElement('test-getter-reactivity');
        if (!(el instanceof TestGetterReactivityComponent))
        {
            throw new Error('Expected TestGetterReactivityComponent');
        }

        document.body.appendChild(el);
        await Promise.resolve();

        expect(el.shadowRoot?.querySelector('.count')
            ?.textContent
            ?.trim() ?? '')
            .toBe('0');

        el.items = ['a', 'b', 'c'];
        await Promise.resolve();
        await Promise.resolve();

        expect(el.shadowRoot?.querySelector('.count')
            ?.textContent
            ?.trim() ?? '')
            .toBe('3');

        el.remove();
    });
});
