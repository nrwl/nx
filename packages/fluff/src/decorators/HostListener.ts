import { MetadataArrayHelper } from './MetadataArrayHelper.js';

export interface HostListenerEntry
{
    method: string;
    event: string;
}

export function HostListener(eventName: string): MethodDecorator
{
    return function(target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor
    {
        const ctor = target.constructor;
        const listeners = MetadataArrayHelper.getOrCreateArray<HostListenerEntry>(ctor, '__hostListeners');
        listeners.push({ method: String(propertyKey), event: eventName });
        return descriptor;
    };
}
