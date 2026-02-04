import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElement.js';
import { TestPropertyUnwrapContainerClass } from './TestPropertyUnwrapContainerClass.js';

export class TestPropertyUnwrapParentComponent extends FluffElement
{
    public __hostClass = new Property<TestPropertyUnwrapContainerClass>({
        initialValue: new TestPropertyUnwrapContainerClass(),
        propertyName: 'hostClass'
    });

    public get hostClass(): TestPropertyUnwrapContainerClass
    {
        const val = this.__hostClass.getValue();
        if (!val)
        {
            throw new Error('hostClass is null');
        }
        return val;
    }

    public set hostClass(val: TestPropertyUnwrapContainerClass)
    {
        this.__hostClass.setValue(val);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = '<test-prop-unwrap-child data-lid="l0"></test-prop-unwrap-child>';
    }
}
