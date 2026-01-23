interface ViewChildEntry
{
    property: string;
    selector: string;
}

function isViewChildArray(val: unknown): val is ViewChildEntry[]
{
    return Array.isArray(val);
}

export function ViewChild(refOrSelector: string): PropertyDecorator
{
    return function(target: object, propertyKey: string | symbol): void
    {
        const ctor = target.constructor;
        const key = String(propertyKey);
        const existing: unknown = Reflect.get(ctor, '__viewChildren');
        const children = isViewChildArray(existing) ? existing : [];
        if (!isViewChildArray(existing))
        {
            Reflect.set(ctor, '__viewChildren', children);
        }
        children.push({ property: key, selector: refOrSelector });
    };
}
