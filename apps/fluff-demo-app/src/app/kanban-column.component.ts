import { Component, HostBinding, HostListener, Input, Output, Publisher } from '@fluffjs/fluff';
import type { Column, Task, TaskStatus } from './models.js';

@Component({
    selector: 'kanban-column', templateUrl: './kanban-column.component.html', styleUrl: './kanban-column.component.css'
})
export class KanbanColumnComponent extends HTMLElement
{
    @Input() public column: Column = { id: 'todo', title: 'To Do', color: '#e74c3c' };
    @Input() public tasks: Task[] = [];
    @Input() public editingTaskId: number | null = null;

    @HostBinding('class.drag-over') public isDragOver = false;

    @HostBinding('attr.data-column-id') public get columnId(): string
    {
        return this.column.id;
    }

    @HostListener('dragover')
    public onDragOver(event: DragEvent): void
    {
        event.preventDefault();
        this.isDragOver = true;
    }

    @HostListener('dragleave')
    public onDragLeave(): void
    {
        this.isDragOver = false;
    }

    @HostListener('drop')
    public onDrop(event: DragEvent): void
    {
        event.preventDefault();
        this.isDragOver = false;
        const taskId = event.dataTransfer?.getData('text/plain');
        if (taskId)
        {
            this.moveTask.emit({ taskId: Number(taskId), newStatus: this.column.id })
                .catch(console.error);
        }
    }

    @Output() public moveTask = new Publisher<{ taskId: number; newStatus: TaskStatus }>();
    @Output() public deleteTask = new Publisher<{ taskId: number }>();
    @Output() public startEdit = new Publisher<{ taskId: number }>();
    @Output() public cancelEdit = new Publisher<void>();
    @Output() public saveEdit = new Publisher<{ taskId: number; updates: Partial<Task> }>();

    public get taskCount(): number
    {
        return this.tasks.length;
    }

    public get availableStatuses(): TaskStatus[]
    {
        const all: TaskStatus[] = ['todo', 'in-progress', 'done'];
        return all.filter(s => s !== this.column.id);
    }

    public onMoveTask(taskId: number, newStatus: TaskStatus): void
    {
        this.moveTask.emit({ taskId, newStatus })
            .catch(console.error);
    }

    public onDeleteTask(taskId: number): void
    {
        this.deleteTask.emit({ taskId })
            .catch(console.error);
    }

    public onStartEdit(taskId: number): void
    {
        this.startEdit.emit({ taskId })
            .catch(console.error);
    }

    public onCancelEdit(): void
    {
        this.cancelEdit.emit()
            .catch(console.error);
    }

    public onSaveEdit(taskId: number, updates: Partial<Task>): void
    {
        this.saveEdit.emit({ taskId, updates })
            .catch(console.error);
    }
}