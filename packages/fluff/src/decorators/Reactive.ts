import type { ReactiveOptions } from '../interfaces/ReactiveOptions.js';

export function Reactive(_options?: ReactiveOptions): PropertyDecorator
{
    return (_target: object, _propertyKey: string | symbol) =>
    {
        // Dummy decorator, replaced by compiler
    };
}
