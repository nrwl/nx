import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Property } from '../utils/Property.js';
import { FluffBase } from './FluffBase.js';
import type { FluffElement } from './FluffElementImpl.js';
import { createPropBindChildComponent } from './tests/createPropBindChildComponent.js';
import { createPropBindParentComponent } from './tests/createPropBindParentComponent.js';

interface ParentComponentInstance extends FluffElement
{
    sourceProperty: Property<number>;
}

interface ChildComponentInstance extends FluffElement
{
    theProp: number;
    __theProp: Property<number>;
}

function isParentComponent(el: unknown): el is ParentComponentInstance
{
    return el instanceof HTMLElement && 'sourceProperty' in el;
}

function isChildComponent(el: unknown): el is ChildComponentInstance
{
    return el instanceof HTMLElement && 'theProp' in el && '__theProp' in el;
}

function hasSourceProperty(t: unknown): t is { sourceProperty: Property<number> }
{
    return typeof t === 'object' && t !== null && 'sourceProperty' in t;
}

describe('Property-to-Property binding propagation', () =>
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

    it('should propagate child property changes back to source Property', async() =>
    {
        const parentTag = 'test-prop-bind-parent-' + Math.random().toString(36).slice(2);
        const childTag = 'test-prop-bind-child-' + Math.random().toString(36).slice(2);

        const ChildComponent = createPropBindChildComponent();
        const ParentComponent = createPropBindParentComponent(childTag);

        FluffBase.__e = [
            (t: unknown): Property<number> =>
            {
                if (hasSourceProperty(t))
                {
                    return t.sourceProperty;
                }
                throw new Error('Invalid type');
            }
        ];

        customElements.define(childTag, ChildComponent);
        customElements.define(parentTag, ParentComponent);

        const parentEl = document.createElement(parentTag);
        document.body.appendChild(parentEl);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        if (!isParentComponent(parentEl))
        {
            throw new Error('Expected ParentComponent');
        }

        const childEl = parentEl.shadowRoot?.querySelector(childTag);
        if (!isChildComponent(childEl))
        {
            throw new Error('Expected ChildComponent');
        }

        expect(childEl.theProp).toBe(2);

        childEl.theProp = 5;

        expect(parentEl.sourceProperty.getValue()).toBe(5);

        parentEl.remove();
    });

    it('should propagate source Property changes to child property', async() =>
    {
        const parentTag = 'test-prop-bind-parent2-' + Math.random().toString(36).slice(2);
        const childTag = 'test-prop-bind-child2-' + Math.random().toString(36).slice(2);

        const ChildComponent = createPropBindChildComponent();
        const ParentComponent = createPropBindParentComponent(childTag);

        FluffBase.__e = [
            (t: unknown): Property<number> =>
            {
                if (hasSourceProperty(t))
                {
                    return t.sourceProperty;
                }
                throw new Error('Invalid type');
            }
        ];

        customElements.define(childTag, ChildComponent);
        customElements.define(parentTag, ParentComponent);

        const parentEl = document.createElement(parentTag);
        document.body.appendChild(parentEl);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        if (!isParentComponent(parentEl))
        {
            throw new Error('Expected ParentComponent');
        }

        const childEl = parentEl.shadowRoot?.querySelector(childTag);
        if (!isChildComponent(childEl))
        {
            throw new Error('Expected ChildComponent');
        }

        expect(childEl.theProp).toBe(2);

        parentEl.sourceProperty.setValue(10);

        expect(childEl.theProp).toBe(10);

        parentEl.remove();
    });
});
