import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Property } from '../utils/Property.js';
import { FluffBase } from './FluffBase.js';
import { FluffElement } from './FluffElement.js';
import {
    createAttributeBindingTestComponent,
    createClassBindingTestComponent,
    createPropertyBindingTestComponent,
    createStyleBindingTestComponent
} from './tests/createPropertyUnwrapNativeTestComponents.js';
import {
    hasItemColor,
    hasItemDisabled,
    hasItemSelected,
    hasItemValue
} from './tests/typeguards.js';

describe('Property unwrapping for native element bindings', () =>
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

    it('should unwrap Property value for class binding on native element', async() =>
    {
        const selectedProp = new Property<boolean>({ initialValue: false, propertyName: 'selected' });

        FluffBase.__e = [
            (_t: unknown, l: unknown): Property<boolean> =>
            {
                if (!hasItemSelected(l))
                {
                    throw new Error('Invalid locals');
                }
                return l.item.selected;
            }
        ];

        const TestClassBindingComponent = createClassBindingTestComponent();

        Reflect.set(TestClassBindingComponent, '__bindings', {
            l0: [{ n: 'active', b: 'class', d: [['item', 'selected']], e: 0 }]
        });

        const tag = 'test-class-unwrap-' + Math.random().toString(36).slice(2);
        customElements.define(tag, TestClassBindingComponent);

        const component = document.createElement(tag);
        if (!(component instanceof FluffElement))
        {
            throw new Error('Expected FluffElement');
        }
        component.__loopContext = { item: { selected: selectedProp } };
        document.body.appendChild(component);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const div = component.shadowRoot?.querySelector('div');
        expect(div).toBeTruthy();
        expect(div?.classList.contains('active')).toBe(false);

        component.remove();
    });

    it('should unwrap Property value for style binding on native element', async() =>
    {
        const colorProp = new Property<string>({ initialValue: 'red', propertyName: 'color' });

        FluffBase.__e = [
            (_t: unknown, l: unknown): Property<string> =>
            {
                if (!hasItemColor(l))
                {
                    throw new Error('Invalid locals');
                }
                return l.item.color;
            }
        ];

        const TestStyleBindingComponent = createStyleBindingTestComponent();

        Reflect.set(TestStyleBindingComponent, '__bindings', {
            l0: [{ n: 'background-color', b: 'style', d: [['item', 'color']], e: 0 }]
        });

        const tag = 'test-style-unwrap-' + Math.random().toString(36).slice(2);
        customElements.define(tag, TestStyleBindingComponent);

        const component = document.createElement(tag);
        if (!(component instanceof FluffElement))
        {
            throw new Error('Expected FluffElement');
        }
        component.__loopContext = { item: { color: colorProp } };
        document.body.appendChild(component);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const div = component.shadowRoot?.querySelector('div');
        if (!div)
        {
            throw new Error('Expected div');
        }
        expect(div.style.backgroundColor).toBe('red');

        component.remove();
    });

    it('should unwrap Property value for property binding on native element', async() =>
    {
        const disabledProp = new Property<boolean>({ initialValue: false, propertyName: 'disabled' });

        FluffBase.__e = [
            (_t: unknown, l: unknown): Property<boolean> =>
            {
                if (!hasItemDisabled(l))
                {
                    throw new Error('Invalid locals');
                }
                return l.item.disabled;
            }
        ];

        const TestPropertyBindingComponent = createPropertyBindingTestComponent();

        Reflect.set(TestPropertyBindingComponent, '__bindings', {
            l0: [{ n: 'disabled', b: 'property', d: [['item', 'disabled']], e: 0 }]
        });

        const tag = 'test-property-unwrap-' + Math.random().toString(36).slice(2);
        customElements.define(tag, TestPropertyBindingComponent);

        const component = document.createElement(tag);
        if (!(component instanceof FluffElement))
        {
            throw new Error('Expected FluffElement');
        }
        component.__loopContext = { item: { disabled: disabledProp } };
        document.body.appendChild(component);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const button = component.shadowRoot?.querySelector('button');
        if (!(button instanceof HTMLButtonElement))
        {
            throw new Error('Expected button');
        }
        expect(button.disabled).toBe(false);

        component.remove();
    });

    it('should unwrap Property value for attribute binding on native element', async() =>
    {
        const valueProp = new Property<string>({ initialValue: 'test-value', propertyName: 'value' });

        FluffBase.__e = [
            (_t: unknown, l: unknown): Property<string> =>
            {
                if (!hasItemValue(l))
                {
                    throw new Error('Invalid locals');
                }
                return l.item.value;
            }
        ];

        const TestAttributeBindingComponent = createAttributeBindingTestComponent();

        Reflect.set(TestAttributeBindingComponent, '__bindings', {
            l0: [{ n: 'data-value', b: 'property', d: [['item', 'value']], e: 0 }]
        });

        const tag = 'test-attribute-unwrap-' + Math.random().toString(36).slice(2);
        customElements.define(tag, TestAttributeBindingComponent);

        const component = document.createElement(tag);
        if (!(component instanceof FluffElement))
        {
            throw new Error('Expected FluffElement');
        }
        component.__loopContext = { item: { value: valueProp } };
        document.body.appendChild(component);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const div = component.shadowRoot?.querySelector('div');
        expect(div).toBeTruthy();
        expect(div?.getAttribute('data-value')).toBe('test-value');

        component.remove();
    });

    it('should update class binding when Property value changes', async() =>
    {
        const selectedProp = new Property<boolean>({ initialValue: true, propertyName: 'selected' });

        FluffBase.__e = [
            (_t: unknown, l: unknown): boolean =>
            {
                if (!hasItemSelected(l))
                {
                    throw new Error('Invalid locals');
                }
                return l.item.selected.getValue() ?? false;
            }
        ];

        const TestClassReactiveComponent = createClassBindingTestComponent();

        Reflect.set(TestClassReactiveComponent, '__bindings', {
            l0: [{ n: 'active', b: 'class', d: [['item', 'selected']], e: 0 }]
        });

        const tag = 'test-class-reactive-' + Math.random().toString(36).slice(2);
        customElements.define(tag, TestClassReactiveComponent);

        const component = document.createElement(tag);
        if (!(component instanceof FluffElement))
        {
            throw new Error('Expected FluffElement');
        }
        component.__loopContext = { item: { selected: selectedProp } };
        document.body.appendChild(component);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const div = component.shadowRoot?.querySelector('div');
        expect(div).toBeTruthy();
        expect(div?.classList.contains('active')).toBe(true);

        selectedProp.setValue(false);
        expect(div?.classList.contains('active')).toBe(false);

        selectedProp.setValue(true);
        expect(div?.classList.contains('active')).toBe(true);

        component.remove();
    });

    it('should update style binding when Property value changes', async() =>
    {
        const colorProp = new Property<string>({ initialValue: 'red', propertyName: 'color' });

        FluffBase.__e = [
            (_t: unknown, l: unknown): string =>
            {
                if (!hasItemColor(l))
                {
                    throw new Error('Invalid locals');
                }
                return l.item.color.getValue() ?? '';
            }
        ];

        const TestStyleReactiveComponent = createStyleBindingTestComponent();

        Reflect.set(TestStyleReactiveComponent, '__bindings', {
            l0: [{ n: 'background-color', b: 'style', d: [['item', 'color']], e: 0 }]
        });

        const tag = 'test-style-reactive-' + Math.random().toString(36).slice(2);
        customElements.define(tag, TestStyleReactiveComponent);

        const component = document.createElement(tag);
        if (!(component instanceof FluffElement))
        {
            throw new Error('Expected FluffElement');
        }
        component.__loopContext = { item: { color: colorProp } };
        document.body.appendChild(component);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const div = component.shadowRoot?.querySelector('div');
        if (!div)
        {
            throw new Error('Expected div');
        }
        expect(div.style.backgroundColor).toBe('red');

        colorProp.setValue('blue');
        expect(div.style.backgroundColor).toBe('blue');

        colorProp.setValue('green');
        expect(div.style.backgroundColor).toBe('green');

        component.remove();
    });

    it('should update property binding when Property value changes', async() =>
    {
        const disabledProp = new Property<boolean>({ initialValue: true, propertyName: 'disabled' });

        FluffBase.__e = [
            (_t: unknown, l: unknown): boolean =>
            {
                if (!hasItemDisabled(l))
                {
                    throw new Error('Invalid locals');
                }
                return l.item.disabled.getValue() ?? false;
            }
        ];

        const TestPropertyReactiveComponent = createPropertyBindingTestComponent();

        Reflect.set(TestPropertyReactiveComponent, '__bindings', {
            l0: [{ n: 'disabled', b: 'property', d: [['item', 'disabled']], e: 0 }]
        });

        const tag = 'test-property-reactive-' + Math.random().toString(36).slice(2);
        customElements.define(tag, TestPropertyReactiveComponent);

        const component = document.createElement(tag);
        if (!(component instanceof FluffElement))
        {
            throw new Error('Expected FluffElement');
        }
        component.__loopContext = { item: { disabled: disabledProp } };
        document.body.appendChild(component);

        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });

        const button = component.shadowRoot?.querySelector('button');
        if (!(button instanceof HTMLButtonElement))
        {
            throw new Error('Expected button');
        }
        expect(button.disabled).toBe(true);

        disabledProp.setValue(false);
        expect(button.disabled).toBe(false);

        disabledProp.setValue(true);
        expect(button.disabled).toBe(true);

        component.remove();
    });
});
