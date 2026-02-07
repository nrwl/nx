import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TestTemplateNestedMarkersComponent } from './tests/TestTemplateNestedMarkersComponent.js';
import { TestHarness } from './tests/TestHarness.js';

describe('MarkerManager (template.content markers)', () =>
{
    beforeEach(() =>
    {
        TestHarness.setExpressionTable([
            (t: unknown): boolean =>
            {
                if (t instanceof TestTemplateNestedMarkersComponent)
                {
                    return t.show;
                }
                throw new Error('Invalid type');
            },
            (t: unknown): string =>
            {
                if (t instanceof TestTemplateNestedMarkersComponent)
                {
                    return t.text;
                }
                throw new Error('Invalid type');
            }
        ], []);
    });

    afterEach(() =>
    {
        TestHarness.resetExpressionTable();
    });

    it('should initialize text markers that are inside a template branch', async() =>
    {
        TestHarness.defineCustomElement('test-template-nested-markers', TestTemplateNestedMarkersComponent);

        const el = TestHarness.mount('test-template-nested-markers');
        if (!(el instanceof TestTemplateNestedMarkersComponent))
        {
            throw new Error('Expected TestTemplateNestedMarkersComponent');
        }

        await TestHarness.tick();

        const text = el.shadowRoot?.querySelector('.title')?.textContent ?? '';
        expect(text.trim())
            .toBe('Hello');

        el.remove();
    });
});
