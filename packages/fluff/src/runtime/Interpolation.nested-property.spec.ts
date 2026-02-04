import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Property } from '../utils/Property.js';
import { FluffBase } from './FluffBase.js';
import { createTestInterpolationNestedPropertyComponent } from './tests/createTestInterpolationNestedPropertyComponent.js';
import { TestInterpolationNestedPropertyComponentBase } from './tests/TestInterpolationNestedPropertyComponentBase.js';
import { TestInterpolationNestedPropertyContainerClass } from './tests/TestInterpolationNestedPropertyContainerClass.js';

describe('Interpolation with nested Property', () =>
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

    it('should unwrap nested Property value in interpolation and display the value', async() =>
    {
        FluffBase.__e = [
            (t: TestInterpolationNestedPropertyComponentBase): Property<number> => t.hostClass.childProp
        ];

        const tag = 'test-interpolation-nested-prop-' + Math.random().toString(36).slice(2);
        const ComponentClass = createTestInterpolationNestedPropertyComponent();
        customElements.define(tag, ComponentClass);

        const el = document.createElement(tag);
        document.body.appendChild(el);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const { shadowRoot } = el;
        expect(shadowRoot).toBeDefined();

        const textContent = shadowRoot?.textContent?.trim();
        expect(textContent).toBe('42');
        expect(textContent).not.toContain('onChange');
        expect(textContent).not.toContain('callbacks');

        el.remove();
    });

    it('should update interpolation when nested Property value changes', async() =>
    {
        FluffBase.__e = [
            (t: TestInterpolationNestedPropertyComponentBase): Property<number> => t.hostClass.childProp
        ];

        const tag = 'test-interpolation-nested-prop-update-' + Math.random().toString(36).slice(2);
        const ComponentClass = createTestInterpolationNestedPropertyComponent();
        customElements.define(tag, ComponentClass);

        const el = document.createElement(tag);
        if (!(el instanceof TestInterpolationNestedPropertyComponentBase))
        {
            throw new Error('Expected TestInterpolationNestedPropertyComponentBase');
        }
        document.body.appendChild(el);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const { shadowRoot } = el;
        expect(shadowRoot?.textContent?.trim()).toBe('42');

        el.hostClass.childProp.setValue(100);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        expect(shadowRoot?.textContent?.trim()).toBe('100');

        el.remove();
    });

    it('should update interpolation when parent container is replaced', async() =>
    {
        FluffBase.__e = [
            (t: TestInterpolationNestedPropertyComponentBase): Property<number> => t.hostClass.childProp
        ];

        const tag = 'test-interpolation-nested-prop-replace-' + Math.random().toString(36).slice(2);
        const ComponentClass = createTestInterpolationNestedPropertyComponent();
        customElements.define(tag, ComponentClass);

        const el = document.createElement(tag);
        if (!(el instanceof TestInterpolationNestedPropertyComponentBase))
        {
            throw new Error('Expected TestInterpolationNestedPropertyComponentBase');
        }
        document.body.appendChild(el);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const { shadowRoot } = el;
        expect(shadowRoot?.textContent?.trim()).toBe('42');

        const newContainer = new TestInterpolationNestedPropertyContainerClass();
        newContainer.childProp.setValue(999);
        el.hostClass = newContainer;

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        expect(shadowRoot?.textContent?.trim()).toBe('999');

        el.remove();
    });
});
