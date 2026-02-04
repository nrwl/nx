import type { IfMarkerConfig } from '../interfaces/IfMarkerConfig.js';
import type { PropertyChain } from '../interfaces/PropertyChain.js';
import type { Subscription } from '../interfaces/Subscription.js';
import { MarkerController } from './MarkerController.js';

export class IfController extends MarkerController
{
    private readonly config: IfMarkerConfig;
    private templates: HTMLTemplateElement[] = [];
    private currentBranchIndex = -1;
    private readonly bindingsSubscriptions: Subscription[] = [];

    public constructor(id: number, startMarker: Comment, endMarker: Comment | null, host: HTMLElement, shadowRoot: ShadowRoot, config: IfMarkerConfig)
    {
        super(id, startMarker, endMarker, host, shadowRoot);
        this.config = config;
    }

    public initialize(): void
    {
        const hostTag = this.host.tagName.toLowerCase();
        const templateIdPrefix = `${hostTag}-${this.id}-`;
        this.templates = Array.from(this.shadowRoot.querySelectorAll<HTMLTemplateElement>(`template[data-fluff-branch^="${templateIdPrefix}"]`));

        const allDeps: PropertyChain[] = [];
        for (const branch of this.config.branches)
        {
            if (branch.deps)
            {
                allDeps.push(...branch.deps);
            }
        }

        const update = (): void =>
        {
            let matchedIndex = -1;

            for (let i = 0; i < this.config.branches.length; i++)
            {
                const branch = this.config.branches[i];
                if (branch.exprId === undefined)
                {
                    matchedIndex = i;
                    break;
                }
                const result = this.evaluateExpr(branch.exprId);
                if (result)
                {
                    matchedIndex = i;
                    break;
                }
            }

            if (matchedIndex !== this.currentBranchIndex)
            {
                this.clearContentBetweenMarkersWithCleanup(this.bindingsSubscriptions);
                this.currentBranchIndex = matchedIndex;

                if (matchedIndex >= 0 && matchedIndex < this.templates.length)
                {
                    this.cloneAndInsertTemplate(this.templates[matchedIndex], this.loopContext, undefined, this.bindingsSubscriptions);
                }

                this.refreshParentBindings();
            }
        };

        this.subscribeTo(allDeps, update);
        update();
    }
}
