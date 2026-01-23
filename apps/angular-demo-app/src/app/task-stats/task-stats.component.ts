import { CommonModule } from '@angular/common';
import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import type { TaskStats } from '../models';

@Component({
    selector: 'app-task-stats',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './task-stats.component.html',
    styleUrl: './task-stats.component.css'
})
export class TaskStatsComponent implements OnInit, OnDestroy
{
    @Input() stats: TaskStats = {
        total: 0,
        byStatus: {'todo': 0, 'in-progress': 0, 'done': 0},
        byPriority: {'low': 0, 'medium': 0, 'high': 0, 'urgent': 0},
        overdue: 0,
        dueToday: 0
    };

    currentTime = new Date().toLocaleTimeString();

    private intervalId: ReturnType<typeof setInterval> | null = null;

    get completionPercent(): number
    {
        if(this.stats.total === 0) return 0;
        return Math.round((this.stats.byStatus.done / this.stats.total) * 100);
    }

    get urgentAndHighCount(): number
    {
        return this.stats.byPriority.urgent + this.stats.byPriority.high;
    }

    ngOnDestroy(): void
    {
        if(this.intervalId !== null)
        {
            clearInterval(this.intervalId);
        }
    }

    ngOnInit(): void
    {
        this.intervalId = setInterval(() =>
        {
            this.currentTime = new Date().toLocaleTimeString();
        }, 1000);
    }
}
