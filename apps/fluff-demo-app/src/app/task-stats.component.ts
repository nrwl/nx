import type { OnDestroy, OnInit } from '@fluffjs/fluff';
import { Component, Input, Reactive } from '@fluffjs/fluff';
import type { TaskStats } from './models.js';

@Component({
    selector: 'task-stats', templateUrl: './task-stats.component.html', styleUrl: './task-stats.component.css'
})
export class TaskStatsComponent extends HTMLElement implements OnInit, OnDestroy
{
    @Input() public stats: TaskStats = {
        total: 0,
        byStatus: { 'todo': 0, 'in-progress': 0, 'done': 0 },
        byPriority: { 'low': 0, 'medium': 0, 'high': 0, 'urgent': 0 },
        overdue: 0,
        dueToday: 0
    };

    @Reactive() public currentTime = new Date().toLocaleTimeString();

    private _intervalId: number | null = null;

    public get completionPercent(): number
    {
        if (this.stats.total === 0) return 0;
        return Math.round((this.stats.byStatus.done / this.stats.total) * 100);
    }

    public get urgentAndHighCount(): number
    {
        return this.stats.byPriority.urgent + this.stats.byPriority.high;
    }

    public onDestroy(): void
    {
        if (this._intervalId !== null)
        {
            clearInterval(this._intervalId);
        }
    }

    public onInit(): void
    {
        this._intervalId = window.setInterval(() =>
        {
            this.currentTime = new Date().toLocaleTimeString();
        }, 1000);
    }
}
