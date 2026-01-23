import type { OnDestroy, Subscription } from '@fluffjs/fluff';
import { Component, HostBinding, HostListener, Input, Output, Publisher, Reactive } from '@fluffjs/fluff';
import type { Task, TaskPriority, TaskStatus } from './models.js';
import { CapitalizePipe, DatePipe, LowercasePipe, TruncatePipe, UppercasePipe } from './pipes.js';

@Component({
    selector: 'task-card',
    templateUrl: './task-card.component.html',
    styleUrl: './task-card.component.css',
    pipes: [UppercasePipe, LowercasePipe, TruncatePipe, CapitalizePipe, DatePipe]
})
export class TaskCardComponent extends HTMLElement implements OnDestroy
{
    @Input() public task: Task | null = null;
    @Input() public isEditing = false;
    @Input() public availableStatuses: TaskStatus[] = [];

    @HostBinding('attr.draggable') public override draggable = true;
    @HostBinding('class.dragging') public isDragging = false;

    @HostListener('dragstart')
    public onDragStart(event: DragEvent): void
    {
        if (this.task)
        {
            event.dataTransfer?.setData('text/plain', String(this.task.id));
            this.isDragging = true;
        }
    }

    @HostListener('dragend')
    public onDragEnd(): void
    {
        this.isDragging = false;
    }

    @Reactive() public editTitle = '';
    @Reactive() public editDescription = '';
    @Reactive() public editPriority: TaskPriority = 'medium';
    @Reactive() public editAssignee = '';
    @Reactive() public editDueDate = '';
    @Reactive() public showMoveMenu = false;

    @Output() public move = new Publisher<{ newStatus: TaskStatus }>();
    @Output() public delete = new Publisher<void>();
    @Output() public edit = new Publisher<void>();
    @Output() public cancelEdit = new Publisher<void>();
    @Output() public save = new Publisher<{ updates: Partial<Task> }>();

    private readonly _watchEditing: Subscription = this.$watch(['isEditing', 'task'], () =>
    {
        if (this.isEditing && this.task)
        {
            this.editTitle = this.task.title;
            this.editDescription = this.task.description;
            this.editPriority = this.task.priority;
            this.editAssignee = this.task.assignee ?? '';
            this.editDueDate = this.task.dueDate ?? '';
        }
    });

    public get priorityClass(): string
    {
        return this.task?.priority ?? 'medium';
    }

    public get isOverdue(): boolean
    {
        if (!this.task?.dueDate || this.task.status === 'done') return false;
        const [today] = new Date().toISOString()
            .split('T');
        return this.task.dueDate < today;
    }

    public get isDueToday(): boolean
    {
        if (!this.task?.dueDate) return false;
        const [today] = new Date().toISOString()
            .split('T');
        return this.task.dueDate === today;
    }

    public get formattedDueDate(): string
    {
        if (!this.task?.dueDate) return '';
        const date = new Date(this.task.dueDate);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    public getStatusLabel(status: TaskStatus): string
    {
        const labels: Record<TaskStatus, string> = {
            'todo': '📋 To Do', 'in-progress': '🔄 In Progress', 'done': '✅ Done'
        };
        return labels[status];
    }

    public onMove(newStatus: TaskStatus): void
    {
        this.showMoveMenu = false;
        this.move.emit({ newStatus })
            .catch(console.error);
    }

    public onDelete(): void
    {
        this.delete.emit()
            .catch(console.error);
    }

    public onEdit(): void
    {
        this.edit.emit()
            .catch(console.error);
    }

    public onCancelEdit(): void
    {
        this.cancelEdit.emit()
            .catch(console.error);
    }

    public onSave(): void
    {
        this.save.emit({
            updates: {
                title: this.editTitle,
                description: this.editDescription,
                priority: this.editPriority,
                assignee: this.editAssignee || null,
                dueDate: this.editDueDate || null
            }
        })
            .catch(console.error);
    }

    public toggleMoveMenu(): void
    {
        this.showMoveMenu = !this.showMoveMenu;
    }

    public setEditPriority(p: TaskPriority): void
    {
        this.editPriority = p;
    }

    public onDestroy(): void
    {
        this._watchEditing.unsubscribe();
    }
}
