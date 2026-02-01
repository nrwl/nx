import type { RenderContext } from '../interfaces/RenderContext.js';
import type { Subscription } from '../interfaces/Subscription.js';
import type { SwitchMarkerConfig } from '../interfaces/SwitchMarkerConfig.js';
import { MarkerController } from './MarkerController.js';

export class SwitchController extends MarkerController
{
    private readonly config: SwitchMarkerConfig;
    private templates: HTMLTemplateElement[] = [];
    private readonly bindingsSubscriptions: Subscription[] = [];

    public constructor(id: number, startMarker: Comment, endMarker: Comment | null, host: HTMLElement, shadowRoot: ShadowRoot, config: SwitchMarkerConfig)
    {
        super(id, startMarker, endMarker, host, shadowRoot);
        this.config = config;
    }

    public initialize(): void
    {
        const hostTag = this.host.tagName.toLowerCase();
        const templateIdPrefix = `${hostTag}-${this.id}-`;
        this.templates = Array.from(this.shadowRoot.querySelectorAll<HTMLTemplateElement>(`template[data-fluff-case^="${templateIdPrefix}"]`));

        const deps = this.config.deps ?? [];

        const update = (): void =>
        {
            this.clearContentBetweenMarkersWithCleanup(this.bindingsSubscriptions);

            const switchValue = this.evaluateExpr(this.config.expressionExprId);
            let matched = false;
            let shouldFallthrough = false;

            const renderContext: RenderContext = {
                shouldBreak: false
            };

            for (let i = 0; i < this.config.cases.length; i++)
            {
                if (renderContext.shouldBreak) break;

                const caseInfo = this.config.cases[i];
                const template = this.templates[i];
                if (!template) continue;

                const caseMatches = caseInfo.isDefault
                    || (caseInfo.valueExprId !== undefined && this.evaluateExpr(caseInfo.valueExprId) === switchValue);

                if (shouldFallthrough || (!matched && caseMatches))
                {
                    matched = true;
                    this.cloneAndInsertTemplate(template, this.loopContext, renderContext, this.bindingsSubscriptions);
                    shouldFallthrough = caseInfo.fallthrough;
                }
            }
        };

        this.subscribeTo(deps, update);
        update();
    }
}
