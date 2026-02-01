import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FluffBase } from './FluffBase.js';
import type { TestTask } from './tests/TestNullInputTextComponent.js';
import { TestNullInputTextComponent } from './tests/TestNullInputTextComponent.js';

describe('TextController (null input safety)', () =>
{
    beforeEach(() =>
    {
        FluffBase.__e = [
            (t: TestNullInputTextComponent): boolean => !t.isEditing,
            (t: { task: TestTask }): string => t.task.title
        ];
        FluffBase.__h = [];
    });

    afterEach(() =>
    {
        FluffBase.__e = [];
        FluffBase.__h = [];
    });

    it('should not throw if expression reads through a null input during initial render', async() =>
    {
        if (!customElements.get('test-null-input-text'))
        {
            customElements.define('test-null-input-text', TestNullInputTextComponent);
        }

        const el = document.createElement('test-null-input-text');
        if (!(el instanceof TestNullInputTextComponent))
        {
            throw new Error('Expected TestNullInputTextComponent');
        }

        const errors: unknown[] = [];
        const onError = (event: Event): void =>
        {
            if (event instanceof ErrorEvent)
            {
                errors.push(event.error);
                event.preventDefault();
            }
        };

        window.addEventListener('error', onError);
        let threw: unknown = undefined;
        try
        {
            document.body.appendChild(el);
        }
        catch(e: unknown)
        {
            threw = e;
        }
        finally
        {
            window.removeEventListener('error', onError);
        }

        expect(threw)
            .toBeUndefined();
        expect(errors)
            .toHaveLength(0);

        el.task = { title: 'Hello' };

        await Promise.resolve();
        await Promise.resolve();

        const text = el.shadowRoot?.querySelector('.title')?.textContent ?? '';
        expect(text.trim())
            .toBe('Hello');

        el.remove();
    });
});
