type Constructor = new (...args: unknown[]) => object;

export interface ComponentConfig
{
    selector: string;
    templateUrl?: string;
    template?: string;
    styleUrl?: string;
    styles?: string;
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

        return target;
    };
}

export function getComponentMetadata(target: Constructor): ComponentMetadata | undefined
{
    return componentRegistry.get(target);
}
