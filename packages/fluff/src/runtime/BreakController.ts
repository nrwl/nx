import type { BreakMarkerConfig } from '../interfaces/BreakMarkerConfig.js';
import type { RenderContext } from '../interfaces/RenderContext.js';
import { MarkerController } from './MarkerController.js';

export class BreakController extends MarkerController
{
    public constructor(id: number, startMarker: Comment, endMarker: Comment | null, host: HTMLElement, shadowRoot: ShadowRoot, _config: BreakMarkerConfig)
    {
        super(id, startMarker, endMarker, host, shadowRoot);
    }

    public initialize(): void
    {
    }

    public override updateRenderContext(renderContext?: RenderContext): void
    {
        if (renderContext)
        {
            renderContext.shouldBreak = true;
        }
    }
}
