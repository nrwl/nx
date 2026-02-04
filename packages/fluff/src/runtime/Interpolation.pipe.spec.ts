import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { createTestInterpolationPipeComponent } from './tests/createTestInterpolationPipeComponent.js';
import { createTestInterpolationPipeWithArgsComponent } from './tests/createTestInterpolationPipeWithArgsComponent.js';

describe('Interpolation with pipes', () =>
{
    beforeEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it('should apply pipe to interpolation value and render transformed text', async() =>
    {
        const ComponentClass = createTestInterpolationPipeComponent();

        FluffBase.__e = [
            (t: unknown): string =>
            {
                if (t instanceof ComponentClass)
                {
                    return t.message;
                }
                throw new Error('Invalid type');
            }
        ];

        const tag = 'test-interpolation-pipe-' + Math.random()
            .toString(36)
            .slice(2);
        customElements.define(tag, ComponentClass);

        const el = document.createElement(tag);
        document.body.appendChild(el);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const { shadowRoot } = el;
        expect(shadowRoot)
            .toBeDefined();
        expect(shadowRoot?.textContent?.trim())
            .toBe('HELLO WORLD');

        el.remove();
    });

    it('should apply pipe with arguments to interpolation value', async() =>
    {
        const ComponentClass = createTestInterpolationPipeWithArgsComponent();

        FluffBase.__e = [
            (t: unknown): string =>
            {
                if (t instanceof ComponentClass)
                {
                    return t.message;
                }
                throw new Error('Invalid type');
            },
            (): number => 5
        ];

        const tag = 'test-interpolation-pipe-args-' + Math.random()
            .toString(36)
            .slice(2);
        customElements.define(tag, ComponentClass);

        const el = document.createElement(tag);
        document.body.appendChild(el);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const { shadowRoot } = el;
        expect(shadowRoot)
            .toBeDefined();
        expect(shadowRoot?.textContent?.trim())
            .toBe('hello...');

        el.remove();
    });

    it('should update rendered text when value changes with pipe applied', async() =>
    {
        const ComponentClass = createTestInterpolationPipeComponent();

        FluffBase.__e = [
            (t: unknown): string =>
            {
                if (t instanceof ComponentClass)
                {
                    return t.message;
                }
                throw new Error('Invalid type');
            }
        ];

        const tag = 'test-interpolation-pipe-update-' + Math.random()
            .toString(36)
            .slice(2);
        customElements.define(tag, ComponentClass);

        const el = document.createElement(tag);
        if (!('message' in el))
        {
            throw new Error('Expected component with message property');
        }
        document.body.appendChild(el);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        expect(el.shadowRoot?.textContent?.trim())
            .toBe('HELLO WORLD');

        el.message = 'goodbye';

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        expect(el.shadowRoot?.textContent?.trim())
            .toBe('GOODBYE');

        el.remove();
    });
});
