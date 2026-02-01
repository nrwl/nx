import { describe, expect, it } from 'vitest';
import { FluffElement } from './FluffElement.js';

describe('Custom element upgrade timing with setContextOnChildren', () =>
{
    it('should have __loopContext available when connectedCallback runs', () =>
    {
        let contextDuringSetup: Record<string, unknown> | undefined = undefined;

        class ChildComponent extends FluffElement
        {
            protected override __render(): void
            {
                this.__getShadowRoot().innerHTML = '<span>child</span>';
            }

            protected override __setupBindings(): void
            {
                contextDuringSetup = { ...this.__loopContext };
            }
        }

        if (!customElements.get('test-context-child'))
        {
            customElements.define('test-context-child', ChildComponent);
        }

        const template = document.createElement('template');
        template.innerHTML = '<test-context-child></test-context-child>';

        const cloned = template.content.cloneNode(true);
        if (!(cloned instanceof DocumentFragment))
        {
            throw new Error('Expected DocumentFragment');
        }
        const child = cloned.querySelector('test-context-child');
        if (!(child instanceof HTMLElement))
        {
            throw new Error('Expected HTMLElement');
        }

        const context = { item: 'test-value', $index: 0 };
        if (child instanceof FluffElement)
        {
            child.__loopContext = context;
        }
        else if (child instanceof HTMLElement && child.tagName.includes('-'))
        {
            child.setAttribute('data-fluff-loop-context', JSON.stringify(context));
        }

        document.body.appendChild(cloned);

        expect(contextDuringSetup)
            .toBeDefined();
        if (contextDuringSetup)
        {
            expect(contextDuringSetup.item)
                .toBe('test-value');
        }

        document.body.querySelector('test-context-child')
            ?.remove();
    });
});
