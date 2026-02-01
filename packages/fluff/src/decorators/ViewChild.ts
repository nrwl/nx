import { MetadataArrayHelper } from './MetadataArrayHelper.js';

export interface ViewChildEntry
{
    property: string;
    selector: string;
}

export function ViewChild(refOrSelector: string): PropertyDecorator
{
    return function(target: object, propertyKey: string | symbol): void
    {
        const ctor = target.constructor;
        const children = MetadataArrayHelper.getOrCreateArray<ViewChildEntry>(ctor, '__viewChildren');
        children.push({ property: String(propertyKey), selector: refOrSelector });
    };
}
