interface PipeInstance
{
    transform: (value: unknown, ...args: unknown[]) => unknown;
}

interface PipeClass
{
    __pipeName?: string;

    new(): PipeInstance;
}

type Constructor = new (...args: unknown[]) => object;

export interface ComponentConfig
{
    selector: string;
    templateUrl?: string;
    template?: string;
    styleUrl?: string;
    styles?: string;
    pipes?: PipeClass[];
}

export interface ComponentMetadata extends ComponentConfig
{
    inputs: Map<string, string>;
    outputs: Map<string, string>;
}

const componentRegistry = new Map<Constructor, ComponentMetadata>();

export function Component(config: ComponentConfig): <T extends Constructor>(target: T) => T
{
    return function <T extends Constructor>(target: T): T
    {
        const metadata: ComponentMetadata = {
            ...config, inputs: new Map(), outputs: new Map()
        };
        componentRegistry.set(target, metadata);

        if (config.pipes && config.pipes.length > 0)
        {
            const pipesObj: Record<string, (...args: unknown[]) => unknown> = {};
            for (const PipeClassItem of config.pipes)
            {
                const pipeName = PipeClassItem.__pipeName;
                if (pipeName)
                {
                    const instance = new PipeClassItem();
                    pipesObj[pipeName] = (value: unknown, ...args: unknown[]): unknown => instance.transform(value, ...args);
                }
            }
            Reflect.set(target.prototype, '__pipes', pipesObj);
        }

        return target;
    };
}

export function getComponentMetadata(target: Constructor): ComponentMetadata | undefined
{
    return componentRegistry.get(target);
}

export function getAllComponents(): Map<Constructor, ComponentMetadata>
{
    return componentRegistry;
}
