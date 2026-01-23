import type { OnDestroy, OnInit, Subscription } from '@fluffjs/fluff';
import { Component, Reactive } from '@fluffjs/fluff';
import type { Column, Task, TaskPriority, TaskStats, TaskStatus } from './models.js';

@Component({
    selector: 'kanban-app', templateUrl: './kanban-app.component.html', styleUrl: './kanban-app.component.css'
})
export class KanbanAppComponent extends HTMLElement implements OnInit, OnDestroy
{
    @Reactive() public currentTime = new Date().toLocaleTimeString();

    private _intervalId: number | null = null;

    @Reactive() public tasks: Task[] = [
        {
            id: 1,
            title: 'Design system architecture',
            description: 'Create high-level design docs',
            status: 'done',
            priority: 'high',
            tags: ['architecture', 'docs'],
            dueDate: '2026-01-20',
            createdAt: '2026-01-15',
            assignee: 'Alice'
        }, {
            id: 2,
            title: 'Implement auth module',
            description: 'JWT-based authentication with refresh tokens',
            status: 'in-progress',
            priority: 'urgent',
            tags: ['backend', 'security'],
            dueDate: '2026-01-25',
            createdAt: '2026-01-16',
            assignee: 'Bob'
        }, {
            id: 3,
            title: 'Setup CI/CD pipeline',
            description: 'GitHub Actions with Docker',
            status: 'in-progress',
            priority: 'high',
            tags: ['devops'],
            dueDate: '2026-01-23',
            createdAt: '2026-01-17',
            assignee: 'Charlie'
        }, {
            id: 4,
            title: 'Write API documentation',
            description: 'OpenAPI spec for all endpoints',
            status: 'todo',
            priority: 'medium',
            tags: ['docs', 'api'],
            dueDate: '2026-01-28',
            createdAt: '2026-01-18',
            assignee: null
        }, {
            id: 5,
            title: 'Database optimization',
            description: 'Add indexes, query optimization',
            status: 'todo',
            priority: 'low',
            tags: ['backend', 'performance'],
            dueDate: null,
            createdAt: '2026-01-19',
            assignee: 'Alice'
        }, {
            id: 6,
            title: 'Unit tests for core',
            description: 'Achieve 80% coverage',
            status: 'todo',
            priority: 'high',
            tags: ['testing'],
            dueDate: '2026-01-22',
            createdAt: '2026-01-20',
            assignee: 'Bob'
        }, {
            id: 7,
            title: 'Fix login bug',
            description: 'Session not persisting after refresh',
            status: 'in-progress',
            priority: 'urgent',
            tags: ['bug', 'frontend'],
            dueDate: '2026-01-21',
            createdAt: '2026-01-21',
            assignee: 'Diana'
        }, {
            id: 8,
            title: 'Mobile responsive design',
            description: 'Ensure all views work on mobile',
            status: 'todo',
            priority: 'medium',
            tags: ['frontend', 'design'],
            dueDate: '2026-01-30',
            createdAt: '2026-01-21',
            assignee: null
        }
    ];

    @Reactive() public columns: Column[] = [
        { id: 'todo', title: 'To Do', color: '#e74c3c' },
        { id: 'in-progress', title: 'In Progress', color: '#f39c12' },
        { id: 'done', title: 'Done', color: '#27ae60' }
    ];

    @Reactive() public searchQuery = '';
    @Reactive() public filterPriority: TaskPriority | 'all' = 'all';
    @Reactive() public filterAssignee = 'all';
    @Reactive() public showStats = true;
    @Reactive() public editingTaskId: number | null = null;

    @Reactive() public filteredTasks: Task[] = this.tasks;
    @Reactive() public stats: TaskStats = this._calculateStats();

    private _nextId = 9;

    private readonly _watchFilters: Subscription = this.$watch([
        'tasks',
        'searchQuery',
        'filterPriority',
        'filterAssignee'
    ], () =>
    {
        this.filteredTasks = this.tasks.filter(task =>
        {
            const matchesSearch = !this.searchQuery || task.title.toLowerCase()
                .includes(this.searchQuery.toLowerCase()) || task.description.toLowerCase()
                .includes(this.searchQuery.toLowerCase()) || task.tags.some(tag => tag.toLowerCase()
                .includes(this.searchQuery.toLowerCase()));

            const matchesPriority = this.filterPriority === 'all' || task.priority === this.filterPriority;
            const matchesAssignee = this.filterAssignee === 'all' || task.assignee === this.filterAssignee;

            return matchesSearch && matchesPriority && matchesAssignee;
        });
        this.stats = this._calculateStats();
    });

    public get assignees(): string[]
    {
        const names = new Set(this.tasks.map(t => t.assignee)
            .filter((a): a is string => a !== null));
        return ['all', ...names];
    }

    public get priorities(): (TaskPriority | 'all')[]
    {
        return ['all', 'low', 'medium', 'high', 'urgent'];
    }

    public getTasksForColumn(status: TaskStatus): Task[]
    {
        return this.filteredTasks.filter(t => t.status === status);
    }

    public addTask(data: { title: string; description: string; priority: TaskPriority; tags: string[] }): void
    {
        const newTask: Task = {
            id: this._nextId++,
            title: data.title,
            description: data.description,
            status: 'todo',
            priority: data.priority,
            tags: data.tags,
            dueDate: null,
            createdAt: new Date().toISOString()
                .split('T')[0],
            assignee: null
        };
        this.tasks = [...this.tasks, newTask];
    }

    public moveTask(taskId: number, newStatus: TaskStatus): void
    {
        this.tasks = this.tasks.map(t => t.id === taskId ? { ...t, status: newStatus } : t);
    }

    public updateTask(taskId: number, updates: Partial<Task>): void
    {
        this.tasks = this.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t);
        this.editingTaskId = null;
    }

    public deleteTask(taskId: number): void
    {
        this.tasks = this.tasks.filter(t => t.id !== taskId);
    }

    public startEditing(taskId: number): void
    {
        this.editingTaskId = taskId;
    }

    public cancelEditing(): void
    {
        this.editingTaskId = null;
    }

    public toggleStats(): void
    {
        this.showStats = !this.showStats;
    }

    public setSearch(query: string): void
    {
        this.searchQuery = query;
    }

    public setFilterPriority(priority: TaskPriority | 'all'): void
    {
        this.filterPriority = priority;
    }

    public setFilterAssignee(assignee: string): void
    {
        this.filterAssignee = assignee;
    }

    public onDestroy(): void
    {
        this._watchFilters.unsubscribe();
        if (this._intervalId !== null)
        {
            clearInterval(this._intervalId);
        }
    }

    private _calculateStats(): TaskStats
    {
        const [today] = new Date().toISOString()
            .split('T');
        return {
            total: this.tasks.length,
            byStatus: {
                'todo': this.tasks.filter(t => t.status === 'todo').length,
                'in-progress': this.tasks.filter(t => t.status === 'in-progress').length,
                'done': this.tasks.filter(t => t.status === 'done').length
            },
            byPriority: {
                'low': this.tasks.filter(t => t.priority === 'low').length,
                'medium': this.tasks.filter(t => t.priority === 'medium').length,
                'high': this.tasks.filter(t => t.priority === 'high').length,
                'urgent': this.tasks.filter(t => t.priority === 'urgent').length
            },
            overdue: this.tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length,
            dueToday: this.tasks.filter(t => t.dueDate === today).length
        };
    }

    public onInit(): void
    {
        this._intervalId = window.setInterval(() =>
        {
            this.currentTime = new Date().toLocaleTimeString();
        }, 1000);
    }
}
