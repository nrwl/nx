type PipeConstructor = (new (...args: unknown[]) => unknown) & { __pipeName?: string };

export function Pipe(name: string): <T extends PipeConstructor>(target: T) => T
{
    return function <T extends PipeConstructor>(target: T): T
    {
        target.__pipeName = name;
        return target;
    };
}

export interface PipeTransform<TArgs extends unknown[] = unknown[], TReturn = unknown>
{
    transform: (value: unknown, ...args: TArgs) => TReturn;
}
