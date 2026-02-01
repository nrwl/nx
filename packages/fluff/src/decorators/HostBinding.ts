import { MetadataArrayHelper } from './MetadataArrayHelper.js';

export interface HostBindingEntry
{
    property: string;
    hostProperty: string;
}

export function HostBinding(hostProperty: string): PropertyDecorator
{
    return function(target: object, propertyKey: string | symbol): void
    {
        const ctor = target.constructor;
        const bindings = MetadataArrayHelper.getOrCreateArray<HostBindingEntry>(ctor, '__hostBindings');
        bindings.push({ property: String(propertyKey), hostProperty });
    };
}
