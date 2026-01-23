export function Watch(..._properties: string[]): MethodDecorator
{
    return function(target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor
    {
        const original: unknown = descriptor.value;
        if (typeof original === 'function')
        {
            Reflect.set(target, `__watch_${String(propertyKey)}`, original);
        }
        return descriptor;
    };
}
