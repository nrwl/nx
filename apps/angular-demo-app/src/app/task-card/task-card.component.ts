import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    HostBinding,
    HostListener,
    Input,
    OnChanges,
    Output,
    SimpleChanges
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { Task, TaskPriority, TaskStatus } from '../models';
import { CapitalizePipe, TruncatePipe } from '../pipes';

@Component({
    selector: 'app-task-card',
    standalone: true,
    imports: [CommonModule, FormsModule, TruncatePipe, CapitalizePipe],
    templateUrl: './task-card.component.html',
    styleUrl: './task-card.component.css'
})
export class TaskCardComponent implements OnChanges
{
    @Input() task: Task | null = null;
    @Input() isEditing = false;
    @Input() availableStatuses: TaskStatus[] = [];

    @HostBinding('attr.draggable') draggable = true;
    @HostBinding('class.dragging') isDragging = false;

    @HostListener('dragstart', ['$event'])
    onDragStart(event: DragEvent): void
    {
        if(this.task)
        {
            event.dataTransfer?.setData('text/plain', String(this.task.id));
            this.isDragging = true;
        }
    }

    @HostListener('dragend')
    onDragEnd(): void
    {
        this.isDragging = false;
    }

    editTitle = '';
    editDescription = '';
    editPriority: TaskPriority = 'medium';
    editAssignee = '';
    editDueDate = '';
    showMoveMenu = false;

    @Output() move = new EventEmitter<{ newStatus: TaskStatus }>();
    @Output() delete = new EventEmitter<void>();
    @Output() edit = new EventEmitter<void>();
    @Output() cancelEdit = new EventEmitter<void>();
    @Output() save = new EventEmitter<{ updates: Partial<Task> }>();

    ngOnChanges(changes: SimpleChanges): void
    {
        if((changes['isEditing'] || changes['task']) && this.isEditing && this.task)
        {
            this.editTitle = this.task.title;
            this.editDescription = this.task.description;
            this.editPriority = this.task.priority;
            this.editAssignee = this.task.assignee ?? '';
            this.editDueDate = this.task.dueDate ?? '';
        }
    }

    get priorityClass(): string
    {
        return this.task?.priority ?? 'medium';
    }

    get isOverdue(): boolean
    {
        if(!this.task?.dueDate || this.task.status === 'done') return false;
        const [today] = new Date().toISOString()
            .split('T');
        return this.task.dueDate < today;
    }

    get isDueToday(): boolean
    {
        if(!this.task?.dueDate) return false;
        const [today] = new Date().toISOString()
            .split('T');
        return this.task.dueDate === today;
    }

    get formattedDueDate(): string
    {
        if(!this.task?.dueDate) return '';
        const date = new Date(this.task.dueDate);
        return date.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
    }

    getStatusLabel(status: TaskStatus): string
    {
        const labels: Record<TaskStatus, string> = {
            'todo': '📋 To Do', 'in-progress': '🔄 In Progress', 'done': '✅ Done'
        };
        return labels[status];
    }

    onMove(newStatus: TaskStatus): void
    {
        this.showMoveMenu = false;
        this.move.emit({newStatus});
    }

    onDelete(): void
    {
        this.delete.emit();
    }

    onEdit(): void
    {
        this.edit.emit();
    }

    onCancelEdit(): void
    {
        this.cancelEdit.emit();
    }

    onSave(): void
    {
        this.save.emit({
            updates: {
                title: this.editTitle,
                description: this.editDescription,
                priority: this.editPriority,
                assignee: this.editAssignee || null,
                dueDate: this.editDueDate || null
            }
        });
    }

    toggleMoveMenu(): void
    {
        this.showMoveMenu = !this.showMoveMenu;
    }

    setEditPriority(p: TaskPriority): void
    {
        this.editPriority = p;
    }
}
