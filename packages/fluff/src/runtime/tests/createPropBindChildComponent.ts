import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElementImpl.js';

interface ChildComponentInstance extends FluffElement
{
    theProp: number;
    __theProp: Property<number>;
}

type ChildComponentConstructor = new () => ChildComponentInstance;

export function createPropBindChildComponent(): ChildComponentConstructor
{
    class ChildComponent extends FluffElement
    {
        public __theProp = new Property<number>({ initialValue: 0, propertyName: 'theProp' });

        public get theProp(): number
        {
            return this.__theProp.getValue() ?? 0;
        }

        public set theProp(val: number)
        {
            this.__theProp.setValue(val);
        }

        protected override __render(): void
        {
            this.__getShadowRoot().innerHTML = '<span>Child value: </span>';
        }

        protected override __setupBindings(): void
        {
            super.__setupBindings();
        }
    }

    return ChildComponent as ChildComponentConstructor;
}
