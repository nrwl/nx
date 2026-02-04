import { getPipeTransform } from '../decorators/Pipe.js';
import type { TextMarkerConfig } from '../interfaces/TextMarkerConfig.js';
import { Property } from '../utils/Property.js';
import { MarkerController } from './MarkerController.js';

export class TextController extends MarkerController
{
    private readonly config: TextMarkerConfig;
    private textNode: Text | null = null;

    public constructor(id: number, startMarker: Comment, endMarker: Comment | null, host: HTMLElement, shadowRoot: ShadowRoot, config: TextMarkerConfig)
    {
        super(id, startMarker, endMarker, host, shadowRoot);
        this.config = config;
    }

    public initialize(): void
    {
        this.textNode = document.createTextNode('');
        this.insertBeforeEndMarker(this.textNode);

        const deps = this.config.deps ?? [];
        const pipes = this.config.pipes ?? [];

        const update = (): void =>
        {
            let result = this.evaluateExpr(this.config.exprId);

            if (result instanceof Property)
            {
                result = result.getValue();
            }

            for (const pipe of pipes)
            {
                result = this.applyPipe(pipe.name, result, pipe.argExprIds);
            }

            if (this.textNode)
            {
                this.textNode.textContent = this.formatValue(result);
            }
        };

        this.subscribeTo(deps, update);
        update();
    }

    private formatValue(result: unknown): string
    {
        if (result === null || result === undefined)
        {
            return '';
        }
        if (typeof result === 'object')
        {
            return JSON.stringify(result);
        }
        if (typeof result === 'string')
        {
            return result;
        }
        if (typeof result === 'number' || typeof result === 'boolean')
        {
            return String(result);
        }
        return '';
    }

    private applyPipe(name: string, value: unknown, args: number[]): unknown
    {
        const pipes = this.host.__pipes;
        const pipeFn = pipes?.[name] ?? getPipeTransform(name);
        if (!pipeFn)
        {
            console.warn(`Pipe "${name}" not found`);
            return value;
        }

        const evaluatedArgs = args.map(arg => this.evaluateExpr(arg));
        return pipeFn(value, ...evaluatedArgs);
    }
}
