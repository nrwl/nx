import { describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import {
    TestForTextMarkerCollisionNoTrackParentComponent
} from './tests/TestForTextMarkerCollisionNoTrackParentComponent.js';
import { TestForTextMarkerCollisionParentComponent } from './tests/TestForTextMarkerCollisionParentComponent.js';

describe('for text marker collision', () =>
{
    it('should render a single @for item when only one marker instance exists', async() =>
    {
        FluffBase.__e = [];
        FluffBase.__e[0] = (t: TestForTextMarkerCollisionParentComponent): string[] => t.tags;
        FluffBase.__e[1] = (t: unknown, l: Record<string, unknown>): unknown => l.tag;
        FluffBase.__h = [];

        const tagName = 'test-for-text-marker-collision-parent';
        if (!customElements.get(tagName))
        {
            customElements.define(tagName, TestForTextMarkerCollisionParentComponent);
        }

        const el = document.createElement(tagName);
        if (!(el instanceof TestForTextMarkerCollisionParentComponent))
        {
            throw new Error('Expected TestForTextMarkerCollisionParentComponent');
        }
        el.tags = ['docs'];
        document.body.appendChild(el);

        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        const tags = Array.from(el.shadowRoot?.querySelectorAll('span.tag') ?? []);
        expect(tags.length)
            .toBe(1);

        const texts = tags.map(t =>
        {
            const text = t.textContent;
            if (typeof text !== 'string')
            {
                return '';
            }
            return text.trim();
        });
        expect(texts)
            .toEqual(['Docs']);

        el.remove();
    });

    it('should render multiple @for iterations when the same text marker id exists multiple times (with pipes)', async() =>
    {
        FluffBase.__e = [];
        FluffBase.__e[0] = (t: TestForTextMarkerCollisionParentComponent): string[] => t.tags;
        FluffBase.__e[1] = (t: unknown, l: Record<string, unknown>): unknown => l.tag;
        FluffBase.__h = [];

        if (!customElements.get('test-for-text-marker-collision-parent'))
        {
            customElements.define('test-for-text-marker-collision-parent', TestForTextMarkerCollisionParentComponent);
        }

        const el = document.createElement('test-for-text-marker-collision-parent');
        if (!(el instanceof TestForTextMarkerCollisionParentComponent))
        {
            throw new Error('Expected TestForTextMarkerCollisionParentComponent');
        }
        el.tags = ['docs', 'api', 'backend'];
        document.body.appendChild(el);

        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        const tags = Array.from(el.shadowRoot?.querySelectorAll('span.tag') ?? []);
        expect(tags.length)
            .toBe(3);

        const texts = tags.map(t =>
        {
            const text = t.textContent;
            if (typeof text !== 'string')
            {
                return '';
            }
            return text.trim();
        });
        expect(texts)
            .toEqual(['Docs', 'Api', 'Backend']);

        el.remove();
    });

    it('should handle empty + reinsert for @for text markers', async() =>
    {
        FluffBase.__e = [];
        FluffBase.__e[0] = (t: TestForTextMarkerCollisionParentComponent): string[] => t.tags;
        FluffBase.__e[1] = (t: unknown, l: Record<string, unknown>): unknown => l.tag;
        FluffBase.__h = [];

        const tagName = 'test-for-text-marker-collision-parent';
        if (!customElements.get(tagName))
        {
            customElements.define(tagName, TestForTextMarkerCollisionParentComponent);
        }

        const el = document.createElement(tagName);
        if (!(el instanceof TestForTextMarkerCollisionParentComponent))
        {
            throw new Error('Expected TestForTextMarkerCollisionParentComponent');
        }
        el.tags = ['docs', 'api'];
        document.body.appendChild(el);

        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        let tags = Array.from(el.shadowRoot?.querySelectorAll('span.tag') ?? []);
        expect(tags.map(t =>
        {
            const text = t.textContent;
            if (typeof text !== 'string')
            {
                return '';
            }
            return text.trim();
        }))
            .toEqual(['Docs', 'Api']);

        el.tags = [];
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        tags = Array.from(el.shadowRoot?.querySelectorAll('span.tag') ?? []);
        expect(tags.length)
            .toBe(0);

        el.tags = ['backend', 'testing'];
        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        tags = Array.from(el.shadowRoot?.querySelectorAll('span.tag') ?? []);
        expect(tags.map(t =>
        {
            const text = t.textContent;
            if (typeof text !== 'string')
            {
                return '';
            }
            return text.trim();
        }))
            .toEqual(['Backend', 'Testing']);

        el.remove();
    });

    it('should render duplicate items when no trackBy is used (no pipes)', async() =>
    {
        FluffBase.__e = [];
        FluffBase.__e[0] = (t: TestForTextMarkerCollisionNoTrackParentComponent): string[] => t.tags;
        FluffBase.__e[1] = (t: unknown, l: Record<string, unknown>): unknown => l.tag;
        FluffBase.__h = [];

        if (!customElements.get('test-for-text-marker-collision-no-track-parent'))
        {
            customElements.define('test-for-text-marker-collision-no-track-parent', TestForTextMarkerCollisionNoTrackParentComponent);
        }

        const el = document.createElement('test-for-text-marker-collision-no-track-parent');
        if (!(el instanceof TestForTextMarkerCollisionNoTrackParentComponent))
        {
            throw new Error('Expected TestForTextMarkerCollisionNoTrackParentComponent');
        }
        el.tags = ['a', 'a'];
        document.body.appendChild(el);

        for (let i = 0; i < 6; i++)
        {
            await Promise.resolve();
        }

        const tags = Array.from(el.shadowRoot?.querySelectorAll('span.tag') ?? []);
        expect(tags.length)
            .toBe(2);

        const texts = tags.map(t =>
        {
            const text = t.textContent;
            if (typeof text !== 'string')
            {
                return '';
            }
            return text.trim();
        });
        expect(texts)
            .toEqual(['a', 'a']);

        el.remove();
    });
});
