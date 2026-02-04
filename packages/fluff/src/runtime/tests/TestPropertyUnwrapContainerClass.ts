import { Property } from '../../utils/Property.js';

export class TestPropertyUnwrapContainerClass
{
    public childProp = new Property<number>({ initialValue: 42, propertyName: 'childProp' });
}
