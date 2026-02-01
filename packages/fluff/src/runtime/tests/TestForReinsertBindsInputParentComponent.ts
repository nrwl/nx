import { Property } from '../../utils/Property.js';
import type { BindingInfo } from '../FluffBase.js';
import { FluffElement } from '../FluffElementImpl.js';
import { MarkerManager } from '../MarkerManager.js';
import type { TaskStats } from './TaskStats.js';

export class TestForReinsertBindsInputParentComponent extends FluffElement
{
    private readonly __items = new Property<number[]>({ initialValue: [0], propertyName: 'items' });
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

    public get items(): number[]
    {
        return this.__items.getValue() ?? [];
    }

    public set items(value: number[])
    {
        this.__items.setValue(value);
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
                    <!--fluff:for:0-->
                    <!--/fluff:for:0-->
                    <template data-fluff-tpl="test-for-reinsert-binds-input-parent-0">
                        <test-if-reinsert-binds-input-child x-fluff-component data-lid="l0"></test-if-reinsert-binds-input-child>
                    </template>
                    <template data-fluff-empty="test-for-reinsert-binds-input-parent-0">
                        <div class="empty">empty</div>
                    </template>
                `;

        this.__setMarkerConfigs(JSON.stringify([
            [0, { type: 'for', iterator: 'item', iterableExprId: 0, deps: ['items'], hasEmpty: true }]
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
