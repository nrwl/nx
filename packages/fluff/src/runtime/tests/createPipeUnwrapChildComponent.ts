import { FluffElement } from '../FluffElementImpl.js';

export interface PipeUnwrapChildComponentInstance extends FluffElement
{
    value: unknown;
}

export type PipeUnwrapChildComponentConstructor = new () => PipeUnwrapChildComponentInstance;

export function createPipeUnwrapChildComponent(): PipeUnwrapChildComponentConstructor
{
    class ChildComponent extends FluffElement
    {
        public value: unknown = null;

        public override __render(): void
        {
            this.__getShadowRoot().innerHTML = '<span>child</span>';
        }
    }

    return ChildComponent as PipeUnwrapChildComponentConstructor;
}
