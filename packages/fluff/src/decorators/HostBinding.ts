interface HostBindingEntry
{
    property: string;
    hostProperty: string;
}

function isHostBindingArray(val: unknown): val is HostBindingEntry[]
{
    return Array.isArray(val);
}

export function HostBinding(hostProperty: string): PropertyDecorator
{
    return function(target: object, propertyKey: string | symbol): void
    {
        const ctor = target.constructor;
        const key = String(propertyKey);
        const existing: unknown = Reflect.get(ctor, '__hostBindings');
        const bindings = isHostBindingArray(existing) ? existing : [];
        if (!isHostBindingArray(existing))
        {
            Reflect.set(ctor, '__hostBindings', bindings);
        }
        bindings.push({ property: key, hostProperty });
    };
}
