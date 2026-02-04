import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElement.js';
import { TestWatchNestedPropertyContainerClass } from './TestWatchNestedPropertyContainerClass.js';

export class TestWatchNestedPropertyParentComponent extends FluffElement
{
    public __hostClass = new Property<TestWatchNestedPropertyContainerClass>({ initialValue: new TestWatchNestedPropertyContainerClass(), propertyName: 'hostClass' });

    public get hostClass(): TestWatchNestedPropertyContainerClass
    {
        const val = this.__hostClass.getValue();
        if (!val)
        {
            throw new Error('hostClass is null');
        }
        return val;
    }

    public set hostClass(val: TestWatchNestedPropertyContainerClass)
    {
        this.__hostClass.setValue(val);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = '<test-watch-nested-child data-lid="l0"></test-watch-nested-child>';
    }
}
