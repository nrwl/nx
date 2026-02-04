interface PipeInstance
{
    transform: (value: unknown, ...args: unknown[]) => unknown;
}

type PipeConstructor = (new () => PipeInstance) & { __pipeName?: string };

const pipeRegistry = new Map<string, PipeConstructor>();

export function getPipeTransform(name: string): ((value: unknown, ...args: unknown[]) => unknown) | undefined
{
    const PipeClass = pipeRegistry.get(name);
    if (!PipeClass) return undefined;
    const instance = new PipeClass();
    return (value: unknown, ...args: unknown[]): unknown => instance.transform(value, ...args);
}

export function Pipe(name: string): <T extends PipeConstructor>(target: T) => T
{
    return function <T extends PipeConstructor>(target: T): T
    {
        target.__pipeName = name;
        pipeRegistry.set(name, target);
        return target;
    };
}

export interface PipeTransform<TArgs extends unknown[] = unknown[], TReturn = unknown>
{
    transform: (value: unknown, ...args: TArgs) => TReturn;
}
