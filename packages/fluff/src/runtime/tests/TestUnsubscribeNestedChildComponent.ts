import { Property } from '../../utils/Property.js';
import type { BindingInfo } from '../FluffBase.js';
import { FluffElement } from '../FluffElementImpl.js';
import type { TaskStats } from './TaskStats.js';

export class TestUnsubscribeNestedChildComponent extends FluffElement
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

    private _statsSetCount = 0;

    public get statsSetCount(): number
    {
        return this._statsSetCount;
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
        this._statsSetCount++;
        this.__stats.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <test-unsubscribe-nested-grandchild x-fluff-component data-lid="l0"></test-unsubscribe-nested-grandchild>
                `;

        const bindings: Record<string, BindingInfo[]> = {
            l0: [{ n: 'stats', b: 'property', e: 4, d: ['stats'] }]
        };

        Reflect.set(this.constructor, '__bindings', bindings);
    }

    protected override __setupBindings(): void
    {
        super.__setupBindings();
    }
}
