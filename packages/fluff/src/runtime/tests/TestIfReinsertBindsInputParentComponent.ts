import { Property } from '../../utils/Property.js';
import type { BindingInfo } from '../FluffBase.js';
import { FluffElement } from '../FluffElementImpl.js';
import { MarkerManager } from '../MarkerManager.js';
import type { TaskStats } from './TaskStats.js';

export class TestIfReinsertBindsInputParentComponent extends FluffElement
{
    private readonly __show = new Property<boolean>({ initialValue: true, propertyName: 'show' });
    private readonly __stats = new Property<TaskStats>({
        initialValue: {
            total: 8,
            byStatus: { 'todo': 0, 'in-progress': 0, 'done': 8 },
            byPriority: { 'low': 0, 'medium': 0, 'high': 0, 'urgent': 0 },
            overdue: 0,
            dueToday: 0
        },
        propertyName: 'stats'
    });

    public get show(): boolean
    {
        return this.__show.getValue() ?? false;
    }

    public set show(value: boolean)
    {
        this.__show.setValue(value);
    }

    public get stats(): TaskStats
    {
        return this.__stats.getValue() ?? {
            total: 0,
            byStatus: { 'todo': 0, 'in-progress': 0, 'done': 0 },
            byPriority: { 'low': 0, 'medium': 0, 'high': 0, 'urgent': 0 },
            overdue: 0,
            dueToday: 0
        };
    }

    public set stats(value: TaskStats)
    {
        this.__stats.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:if:0-->
                    <!--/fluff:if:0-->
                    <template data-fluff-branch="test-if-reinsert-binds-input-parent-0-0">
                        <test-if-reinsert-binds-input-child x-fluff-component data-lid="l0"></test-if-reinsert-binds-input-child>
                    </template>
                `;

        this.__setMarkerConfigs(JSON.stringify([
            [0, { type: 'if', branches: [{ exprId: 0, deps: ['show'] }] }]
        ]));

        const bindings: Record<string, BindingInfo[]> = {
            l0: [{ n: 'stats', b: 'property', e: 1, d: ['stats'] }]
        };

        Reflect.set(this.constructor, '__bindings', bindings);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
