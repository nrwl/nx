import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElementImpl.js';

export interface PipeUnwrapTestState
{
    receivedValue: unknown;
    receivedValueType: string;
}

export interface PipeUnwrapParentComponentInstance extends FluffElement
{
    testProp: number;
    __testProp: Property<number>;
}

export type PipeUnwrapParentComponentConstructor = new () => PipeUnwrapParentComponentInstance;

export function createPipeUnwrapParentComponent(state: PipeUnwrapTestState, childTag: string): PipeUnwrapParentComponentConstructor
{
    class ParentComponent extends FluffElement
    {
        public __testProp = new Property<number>({ initialValue: 99, propertyName: 'testProp' });

        public get testProp(): number
        {
            return this.__testProp.getValue() ?? 0;
        }

        public set testProp(val: number)
        {
            this.__testProp.setValue(val);
        }

        public override __pipes: Record<string, (value: unknown, ...args: unknown[]) => unknown> = {
            capture: (value: unknown): unknown =>
            {
                state.receivedValue = value;
                state.receivedValueType = value instanceof Property ? 'Property' : typeof value;
                return value;
            }
        };

        public override __render(): void
        {
            this.__getShadowRoot().innerHTML = `<${childTag} data-lid="l0"></${childTag}>`;
        }
    }

    return ParentComponent as PipeUnwrapParentComponentConstructor;
}
