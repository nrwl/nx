import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElementImpl.js';
import { MarkerManager } from '../MarkerManager.js';
import type { TaskStats } from './TaskStats.js';

export class TestUnsubscribeNestedGrandchildComponent extends FluffElement
{
    private readonly __stats = new Property<TaskStats>({
        initialValue: {
            total: 0,
            byStatus: { 'todo': 0, 'in-progress': 0, 'done': 0 },
            byPriority: { 'low': 0, 'medium': 0, 'high': 0, 'urgent': 0 },
            overdue: 0,
            dueToday: 0
        },
        propertyName: 'stats'
    });

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
                    <div class="total"><!--fluff:text:0--><!--/fluff:text:0--></div>
                `;

        this.__setMarkerConfigs(JSON.stringify([
            [0, { type: 'text', exprId: 5, deps: ['stats'], pipes: [] }]
        ]));
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
