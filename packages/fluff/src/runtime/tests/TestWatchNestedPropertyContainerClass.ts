import { Property } from '../../utils/Property.js';

export class TestWatchNestedPropertyContainerClass
{
    public childProp = new Property<number>({ initialValue: 0, propertyName: 'childProp' });
}
