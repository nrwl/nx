import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElement.js';

export let testWatchNestedPropertyCallCount = 0;
export let testWatchNestedPropertyLastValue: number | null = null;

export function resetTestWatchNestedPropertyState(): void
{
    testWatchNestedPropertyCallCount = 0;
    testWatchNestedPropertyLastValue = null;
}

export class TestWatchNestedPropertyChildComponent extends FluffElement
{
    public __property = new Property<number | null>({ initialValue: null, propertyName: 'property' });

    public get property(): number | null
    {
        return this.__property.getValue();
    }

    public set property(val: number | null)
    {
        this.__property.setValue(val);
    }

    public constructor()
    {
        super();
        this.__baseSubscriptions.push(
            this.__property.onChange.subscribe(() =>
            {
                this.onPropertyChange();
            })
        );
    }

    public onPropertyChange(): void
    {
        testWatchNestedPropertyCallCount++;
        testWatchNestedPropertyLastValue = this.property;
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = '<span></span>';
    }
}
