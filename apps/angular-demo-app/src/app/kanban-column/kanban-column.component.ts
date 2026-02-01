import { CommonModule } from '@angular/common';
import { Component, EventEmitter, HostBinding, HostListener, Input, Output } from '@angular/core';
import type { Column, Task, TaskStatus } from '../models';
import { TaskCardComponent } from '../task-card/task-card.component';

@Component({
    selector: 'app-kanban-column',
    standalone: true,
    imports: [CommonModule, TaskCardComponent],
    templateUrl: './kanban-column.component.html',
    styleUrl: './kanban-column.component.css'
})
export class KanbanColumnComponent
{
    @Input() column: Column = { id: 'todo', title: 'To Do', color: '#e74c3c' };
    @Input() tasks: Task[] = [];
    @Input() editingTaskId: number | null = null;

    @HostBinding('class.drag-over') isDragOver = false;

    @HostBinding('attr.data-column-id') get columnId(): string
    {
        return this.column.id;
    }

    @HostListener('dragover', ['$event'])
    onDragOver(event: DragEvent): void
    {
        event.preventDefault();
        this.isDragOver = true;
    }

    @HostListener('dragleave')
    onDragLeave(): void
    {
        this.isDragOver = false;
    }

    @HostListener('drop', ['$event'])
    onDrop(event: DragEvent): void
    {
        event.preventDefault();
        this.isDragOver = false;
        const taskId = event.dataTransfer?.getData('text/plain');
        if (taskId)
        {
            this.moveTask.emit({ taskId: Number(taskId), newStatus: this.column.id });
        }
    }

    @Output() moveTask = new EventEmitter<{ taskId: number; newStatus: TaskStatus }>();
    @Output() deleteTask = new EventEmitter<{ taskId: number }>();
    @Output() startEdit = new EventEmitter<{ taskId: number }>();
    @Output() cancelEdit = new EventEmitter<void>();
    @Output() saveEdit = new EventEmitter<{ taskId: number; updates: Partial<Task> }>();

    get taskCount(): number
    {
        return this.tasks.length;
    }

    get availableStatuses(): TaskStatus[]
    {
        const all: TaskStatus[] = ['todo', 'in-progress', 'done'];
        return all.filter(s => s !== this.column.id);
    }

    onMoveTask(taskId: number, newStatus: TaskStatus): void
    {
        this.moveTask.emit({ taskId, newStatus });
    }

    onDeleteTask(taskId: number): void
    {
        this.deleteTask.emit({ taskId });
    }

    onStartEdit(taskId: number): void
    {
        this.startEdit.emit({ taskId });
    }

    onCancelEdit(): void
    {
        this.cancelEdit.emit();
    }

    onSaveEdit(taskId: number, updates: Partial<Task>): void
    {
        this.saveEdit.emit({ taskId, updates });
    }
}
