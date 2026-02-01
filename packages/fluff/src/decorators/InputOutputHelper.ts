import { getComponentMetadata } from './Component.js';

type Constructor = new (...args: unknown[]) => object;

function isConstructor(val: unknown): val is Constructor
{
    return typeof val === 'function';
}

export function createInputOutputDecorator(type: 'inputs' | 'outputs'): (bindingName?: string) => PropertyDecorator
{
    return function(bindingName?: string): PropertyDecorator
    {
        return function(target: object, propertyKey: string | symbol): void
        {
            const { constructor } = target;
            if (!isConstructor(constructor)) return;
            const metadata = getComponentMetadata(constructor);
            if (metadata)
            {
                const name = bindingName ?? String(propertyKey);
                metadata[type].set(String(propertyKey), name);
            }
        };
    };
}
