import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestInterpolationPipeComponent } from './tests/createTestInterpolationPipeComponent.js';
import { createTestInterpolationPipeWithArgsComponent } from './tests/createTestInterpolationPipeWithArgsComponent.js';
import { TestHarness } from './tests/TestHarness.js';

describe('Interpolation with pipes', () =>
{
    beforeEach(() =>
    {
        TestHarness.resetExpressionTable();
    });

    afterEach(() =>
    {
        TestHarness.resetExpressionTable();
    });

    it('should apply pipe to interpolation value and render transformed text', async() =>
    {
        const ComponentClass = createTestInterpolationPipeComponent();

        TestHarness.setExpressionTable([
            (t: unknown): string =>
            {
                if (t instanceof ComponentClass)
                {
                    return t.message;
                }
                throw new Error('Invalid type');
            }
        ], []);

        const tag = 'test-interpolation-pipe-' + Math.random()
            .toString(36)
            .slice(2);
        TestHarness.defineCustomElement(tag, ComponentClass);

        const el = TestHarness.mount(tag);

        await TestHarness.waitForTimeout();

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

        TestHarness.setExpressionTable([
            (t: unknown): string =>
            {
                if (t instanceof ComponentClass)
                {
                    return t.message;
                }
                throw new Error('Invalid type');
            },
            (): number => 5
        ], []);

        const tag = 'test-interpolation-pipe-args-' + Math.random()
            .toString(36)
            .slice(2);
        TestHarness.defineCustomElement(tag, ComponentClass);

        const el = TestHarness.mount(tag);

        await TestHarness.waitForTimeout();

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

        TestHarness.setExpressionTable([
            (t: unknown): string =>
            {
                if (t instanceof ComponentClass)
                {
                    return t.message;
                }
                throw new Error('Invalid type');
            }
        ], []);

        const tag = 'test-interpolation-pipe-update-' + Math.random()
            .toString(36)
            .slice(2);
        TestHarness.defineCustomElement(tag, ComponentClass);

        const el = TestHarness.mount(tag);
        if (!('message' in el))
        {
            throw new Error('Expected component with message property');
        }

        await TestHarness.waitForTimeout();

        expect(el.shadowRoot?.textContent?.trim())
            .toBe('HELLO WORLD');

        el.message = 'goodbye';

        await TestHarness.waitForTimeout();

        expect(el.shadowRoot?.textContent?.trim())
            .toBe('GOODBYE');

        el.remove();
    });
});
