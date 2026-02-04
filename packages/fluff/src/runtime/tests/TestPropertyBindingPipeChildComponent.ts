import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElement.js';

export let testPropertyBindingPipeReceivedValue: unknown = undefined;

export function resetTestPropertyBindingPipeReceivedValue(): void
{
    testPropertyBindingPipeReceivedValue = undefined;
}

export class TestPropertyBindingPipeChildComponent extends FluffElement
{
    public __value = new Property<unknown>({ initialValue: undefined, propertyName: 'value' });

    public get value(): unknown
    {
        return this.__value.getValue();
    }

    public set value(val: unknown)
    {
        this.__value.setValue(val);
        testPropertyBindingPipeReceivedValue = val;
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = '<span>child</span>';
    }
}
