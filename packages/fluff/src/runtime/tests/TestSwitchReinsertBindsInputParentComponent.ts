import { Property } from '../../utils/Property.js';
import type { BindingInfo } from '../FluffBase.js';
import { FluffElement } from '../FluffElementImpl.js';
import { MarkerManager } from '../MarkerManager.js';
import type { TaskStats } from './TaskStats.js';

export class TestSwitchReinsertBindsInputParentComponent extends FluffElement
{
    private readonly __mode = new Property<string>({ initialValue: 'a', propertyName: 'mode' });
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

    public get mode(): string
    {
        return this.__mode.getValue() ?? 'a';
    }

    public set mode(value: string)
    {
        this.__mode.setValue(value);
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
                    <!--fluff:switch:0-->
                    <!--/fluff:switch:0-->
                    <template data-fluff-case="test-switch-reinsert-binds-input-parent-0-0">
                        <test-switch-reinsert-binds-input-child x-fluff-component data-lid="l0"></test-switch-reinsert-binds-input-child>
                    </template>
                    <template data-fluff-case="test-switch-reinsert-binds-input-parent-0-1">
                        <test-switch-reinsert-binds-input-child x-fluff-component data-lid="l1"></test-switch-reinsert-binds-input-child>
                    </template>
                `;

        this.__setMarkerConfigs(JSON.stringify([
            [
                0, {
                type: 'switch', expressionExprId: 0, deps: ['mode'], cases: [
                    { valueExprId: 1, isDefault: false, fallthrough: false },
                    { valueExprId: 2, isDefault: false, fallthrough: false }
                ]
            }
            ]
        ]));

        const bindings: Record<string, BindingInfo[]> = {
            l0: [{ n: 'stats', b: 'property', e: 3, d: ['stats'] }],
            l1: [{ n: 'stats', b: 'property', e: 3, d: ['stats'] }]
        };

        Reflect.set(this.constructor, '__bindings', bindings);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
