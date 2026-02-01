import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElementImpl.js';
import type { TaskStats } from './TaskStats.js';

export abstract class TestUnsubscribeNestedParentBaseComponent extends FluffElement
{
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

    public setStatsTotal(total: number): void
    {
        const current = this.stats;
        this.stats = {
            ...current,
            total
        };
    }
}
