import type { ForMarkerConfig } from '../interfaces/ForMarkerConfig.js';
import type { RenderContext } from '../interfaces/RenderContext.js';
import type { Subscription } from '../interfaces/Subscription.js';
import { MarkerController } from './MarkerController.js';

export class ForController extends MarkerController
{
    private readonly config: ForMarkerConfig;
    private itemTemplate: HTMLTemplateElement | null = null;
    private emptyTemplate: HTMLTemplateElement | null = null;
    private readonly bindingsSubscriptions: Subscription[] = [];

    public constructor(id: number, startMarker: Comment, endMarker: Comment | null, host: HTMLElement, shadowRoot: ShadowRoot, config: ForMarkerConfig)
    {
        super(id, startMarker, endMarker, host, shadowRoot);
        this.config = config;
    }

    public initialize(): void
    {
        const hostTag = this.host.tagName.toLowerCase();
        const templateId = `${hostTag}-${this.id}`;
        this.itemTemplate = this.shadowRoot.querySelector<HTMLTemplateElement>(`template[data-fluff-tpl="${templateId}"]`);
        this.emptyTemplate = this.shadowRoot.querySelector<HTMLTemplateElement>(`template[data-fluff-empty="${templateId}"]`);

        const deps = this.config.deps ?? [];

        const update = (): void =>
        {
            this.clearContentBetweenMarkersWithCleanup(this.bindingsSubscriptions);

            const items = this.evaluateExpr(this.config.iterableExprId);
            if (!Array.isArray(items) || items.length === 0)
            {
                if (this.emptyTemplate)
                {
                    this.cloneAndInsertTemplate(this.emptyTemplate, this.loopContext, undefined, this.bindingsSubscriptions);
                }
                return;
            }

            if (!this.itemTemplate) return;

            const renderContext: RenderContext = {
                shouldBreak: false
            };

            for (let i = 0; i < items.length; i++)
            {
                if (renderContext.shouldBreak) break;

                const itemContext = {
                    ...this.loopContext, [this.config.iterator]: items[i], $index: i
                };

                this.cloneAndInsertTemplate(this.itemTemplate, itemContext, renderContext, this.bindingsSubscriptions);
            }

        };

        this.subscribeTo(deps, update);
        update();
    }
}
