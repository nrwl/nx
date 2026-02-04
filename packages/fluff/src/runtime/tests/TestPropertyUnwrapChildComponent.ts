import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElement.js';

export let testPropertyUnwrapReceivedValue: number | null = null;

export function resetTestPropertyUnwrapReceivedValue(): void
{
    testPropertyUnwrapReceivedValue = null;
}

export class TestPropertyUnwrapChildComponent extends FluffElement
{
    public __property = new Property<number | null>({ initialValue: null, propertyName: 'property' });

    public get property(): number | null
    {
        return this.__property.getValue();
    }

    public set property(val: number | null)
    {
        testPropertyUnwrapReceivedValue = val;
        this.__property.setValue(val);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = '<span></span>';
    }
}
