import { describe, expect, it } from 'vitest';
import {
    TestForTextMarkerCollisionNoTrackParentComponent
} from './tests/TestForTextMarkerCollisionNoTrackParentComponent.js';
import { TestForTextMarkerCollisionParentComponent } from './tests/TestForTextMarkerCollisionParentComponent.js';
import { TestHarness } from './tests/TestHarness.js';

describe('for text marker collision', () =>
{
    it('should render a single @for item when only one marker instance exists', async() =>
    {
        TestHarness.setExpressionTable([
            (t: unknown): string[] =>
            {
                if (t instanceof TestForTextMarkerCollisionParentComponent)
                {
                    return t.tags;
                }
                throw new Error('Invalid type');
            },
            (_t: unknown, l: Record<string, unknown>): unknown => l.tag
        ], []);

        const tagName = 'test-for-text-marker-collision-parent';
        TestHarness.defineCustomElement(tagName, TestForTextMarkerCollisionParentComponent);

        const el = TestHarness.mount(tagName);
        if (!(el instanceof TestForTextMarkerCollisionParentComponent))
        {
            throw new Error('Expected TestForTextMarkerCollisionParentComponent');
        }
        el.tags = ['docs'];

        await TestHarness.tick(6);

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
        TestHarness.setExpressionTable([
            (t: unknown): string[] =>
            {
                if (t instanceof TestForTextMarkerCollisionParentComponent)
                {
                    return t.tags;
                }
                throw new Error('Invalid type');
            },
            (_t: unknown, l: Record<string, unknown>): unknown => l.tag
        ], []);

        TestHarness.defineCustomElement('test-for-text-marker-collision-parent', TestForTextMarkerCollisionParentComponent);

        const el = TestHarness.mount('test-for-text-marker-collision-parent');
        if (!(el instanceof TestForTextMarkerCollisionParentComponent))
        {
            throw new Error('Expected TestForTextMarkerCollisionParentComponent');
        }
        el.tags = ['docs', 'api', 'backend'];

        await TestHarness.tick(6);

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
        TestHarness.setExpressionTable([
            (t: unknown): string[] =>
            {
                if (t instanceof TestForTextMarkerCollisionParentComponent)
                {
                    return t.tags;
                }
                throw new Error('Invalid type');
            },
            (_t: unknown, l: Record<string, unknown>): unknown => l.tag
        ], []);

        const tagName = 'test-for-text-marker-collision-parent';
        TestHarness.defineCustomElement(tagName, TestForTextMarkerCollisionParentComponent);

        const el = TestHarness.mount(tagName);
        if (!(el instanceof TestForTextMarkerCollisionParentComponent))
        {
            throw new Error('Expected TestForTextMarkerCollisionParentComponent');
        }
        el.tags = ['docs', 'api'];

        await TestHarness.tick(6);

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
        await TestHarness.tick(6);

        tags = Array.from(el.shadowRoot?.querySelectorAll('span.tag') ?? []);
        expect(tags.length)
            .toBe(0);

        el.tags = ['backend', 'testing'];
        await TestHarness.tick(6);

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
        TestHarness.setExpressionTable([
            (t: unknown): string[] =>
            {
                if (t instanceof TestForTextMarkerCollisionNoTrackParentComponent)
                {
                    return t.tags;
                }
                throw new Error('Invalid type');
            },
            (_t: unknown, l: Record<string, unknown>): unknown => l.tag
        ], []);

        TestHarness.defineCustomElement('test-for-text-marker-collision-no-track-parent', TestForTextMarkerCollisionNoTrackParentComponent);

        const el = TestHarness.mount('test-for-text-marker-collision-no-track-parent');
        if (!(el instanceof TestForTextMarkerCollisionNoTrackParentComponent))
        {
            throw new Error('Expected TestForTextMarkerCollisionNoTrackParentComponent');
        }
        el.tags = ['a', 'a'];

        await TestHarness.tick(6);

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
