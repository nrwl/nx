interface HostListenerEntry
{
    method: string;
    event: string;
}

function isHostListenerArray(val: unknown): val is HostListenerEntry[]
{
    return Array.isArray(val);
}

export function HostListener(eventName: string): MethodDecorator
{
    return function(target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor
    {
        const ctor = target.constructor;
        const key = String(propertyKey);
        const existing: unknown = Reflect.get(ctor, '__hostListeners');
        const listeners = isHostListenerArray(existing) ? existing : [];
        if (!isHostListenerArray(existing))
        {
            Reflect.set(ctor, '__hostListeners', listeners);
        }
        listeners.push({ method: key, event: eventName });
        return descriptor;
    };
}
