import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElementImpl.js';
import { MarkerManager } from '../MarkerManager.js';

export interface PipeUnwrapTestState
{
    receivedValue: unknown;
    receivedValueType: string;
}

export interface PipeUnwrapTestComponentInstance extends FluffElement
{
    testProp: number;
    __testProp: Property<number>;
}

export type PipeUnwrapTestComponentConstructor = new () => PipeUnwrapTestComponentInstance;

export function createPipeUnwrapTestComponent(state: PipeUnwrapTestState): PipeUnwrapTestComponentConstructor
{
    class TestComponent extends FluffElement
    {
        public __testProp = new Property<number>({ initialValue: 42, propertyName: 'testProp' });

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

        protected override __render(): void
        {
            this.__getShadowRoot().innerHTML = '<span><!--fluff:text:0--><!--/fluff:text:0--></span>';
            this.__setMarkerConfigs(JSON.stringify([
                [0, { type: 'text', exprId: 0, deps: ['testProp'], pipes: [{ name: 'capture', argExprIds: [] }] }]
            ]));
        }

        protected override __setupBindings(): void
        {
            this.__initializeMarkers(MarkerManager);
            super.__setupBindings();
        }
    }

    return TestComponent as PipeUnwrapTestComponentConstructor;
}
