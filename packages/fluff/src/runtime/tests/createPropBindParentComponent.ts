import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElementImpl.js';

interface ParentComponentInstance extends FluffElement
{
    sourceProperty: Property<number>;
}

type ParentComponentConstructor = new () => ParentComponentInstance;

export function createPropBindParentComponent(childTag: string): ParentComponentConstructor
{
    class ParentComponent extends FluffElement
    {
        public sourceProperty = new Property<number>({ initialValue: 2, propertyName: 'sourceProperty' });

        protected override __render(): void
        {
            this.__getShadowRoot().innerHTML = `
                <${childTag} x-fluff-component data-lid="l0"></${childTag}>
            `;
        }

        protected override __setupBindings(): void
        {
            super.__setupBindings();
        }
    }

    ParentComponent.__bindings = {
        l0: [{ n: 'theProp', b: 'property', e: 0, d: [] }]
    };

    return ParentComponent as ParentComponentConstructor;
}
