import { Property } from '../../utils/Property.js';

export class TestInterpolationNestedPropertyContainerClass
{
    public childProp = new Property<number>({ initialValue: 42, propertyName: 'childProp' });
}
