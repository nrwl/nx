import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, Output, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import type { TaskPriority } from '../models';

@Component({
    selector: 'app-task-form',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './task-form.component.html',
    styleUrl: './task-form.component.css'
})
export class TaskFormComponent
{
    @ViewChild('titleInput') titleInputEl!: ElementRef<HTMLInputElement>;

    isExpanded = false;
    taskTitle = '';
    description = '';
    priority: TaskPriority = 'medium';
    tagsInput = '';

    @Output() submitTask = new EventEmitter<{
        title: string;
        description: string;
        priority: TaskPriority;
        tags: string[]
    }>();

    get parsedTags(): string[]
    {
        return this.tagsInput
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);
    }

    toggleForm(): void
    {
        this.isExpanded = !this.isExpanded;
        if (!this.isExpanded)
        {
            this.resetForm();
        }
    }

    focusTitleTemplateRef(input: HTMLInputElement): void
    {
        input.focus();
    }

    focusTitleViewChild(): void
    {
        this.titleInputEl?.nativeElement?.focus();
    }

    handleSubmit(): void
    {
        if (!this.taskTitle.trim()) return;

        this.submitTask.emit({
            title: this.taskTitle.trim(),
            description: this.description.trim(),
            priority: this.priority,
            tags: this.parsedTags
        });

        this.resetForm();
        this.isExpanded = false;
    }

    setPriority(p: TaskPriority): void
    {
        this.priority = p;
    }

    private resetForm(): void
    {
        this.taskTitle = '';
        this.description = '';
        this.priority = 'medium';
        this.tagsInput = '';
    }
}
