import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import { TestTemplateNestedMarkersComponent } from './tests/TestTemplateNestedMarkersComponent.js';

describe('MarkerManager (template.content markers)', () =>
{
    beforeEach(() =>
    {
        FluffBase.__e = [
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
        ];
        FluffBase.__h = [];
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it('should initialize text markers that are inside a template branch', async() =>
    {
        if (!customElements.get('test-template-nested-markers'))
        {
            customElements.define('test-template-nested-markers', TestTemplateNestedMarkersComponent);
        }

        const el = document.createElement('test-template-nested-markers');
        if (!(el instanceof TestTemplateNestedMarkersComponent))
        {
            throw new Error('Expected TestTemplateNestedMarkersComponent');
        }

        document.body.appendChild(el);

        await Promise.resolve();

        const text = el.shadowRoot?.querySelector('.title')?.textContent ?? '';
        expect(text.trim())
            .toBe('Hello');

        el.remove();
    });
});
