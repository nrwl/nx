import { FluffElement } from '../FluffElement.js';

function createTestComponent(html: string): CustomElementConstructor
{
    return class extends FluffElement
    {
        protected override __render(): void
        {
            this.__getShadowRoot().innerHTML = html;
        }

        protected override __setupBindings(): void
        {
            this.__processBindings();
        }
    };
}

export function createClassBindingTestComponent(): CustomElementConstructor
{
    return createTestComponent('<div data-lid="l0">test</div>');
}

export function createStyleBindingTestComponent(): CustomElementConstructor
{
    return createTestComponent('<div data-lid="l0">test</div>');
}

export function createPropertyBindingTestComponent(): CustomElementConstructor
{
    return createTestComponent('<button data-lid="l0">test</button>');
}

export function createAttributeBindingTestComponent(): CustomElementConstructor
{
    return createTestComponent('<div data-lid="l0">test</div>');
}
