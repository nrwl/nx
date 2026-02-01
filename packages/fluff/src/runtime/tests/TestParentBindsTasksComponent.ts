import { FluffElement } from '../FluffElement.js';
import { MarkerManager } from '../MarkerManager.js';

export class TestParentBindsTasksComponent extends FluffElement
{
    public tasksForChild: number[] = [1, 2, 3];
    public childList: number[] = [0];

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:for:0-->
                    <!--/fluff:for:0-->
                    <template data-fluff-tpl="test-parent-binds-tasks-0">
                        <test-child-tasks-list x-fluff-component="" data-lid="l0"></test-child-tasks-list>
                    </template>
                `;

        this.__setMarkerConfigs(JSON.stringify([
            [0, { type: 'for', iterator: 'child', iterableExprId: 0, deps: ['childList'], hasEmpty: false }]
        ]));
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
