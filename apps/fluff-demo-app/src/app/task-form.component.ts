import { Component, Output, Publisher, Reactive, ViewChild } from '@fluffjs/fluff';
import type { TaskPriority } from './models.js';

@Component({
    selector: 'task-form', templateUrl: './task-form.component.html', styleUrl: './task-form.component.css'
})
export class TaskFormComponent extends HTMLElement
{
    @ViewChild('titleInput') public titleInputEl!: HTMLInputElement;

    @Reactive() public isExpanded = false;
    @Reactive() public taskTitle = '';
    @Reactive() public description = '';
    @Reactive() public priority: TaskPriority = 'medium';
    @Reactive() public tagsInput = '';

    @Reactive() public status = 0;

    @Output() public submit = new Publisher<{
        title: string;
        description: string;
        priority: TaskPriority;
        tags: string[]
    }>();

    public get parsedTags(): string[]
    {
        return this.tagsInput
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);
    }

    public toggleForm(): void
    {
        this.isExpanded = !this.isExpanded;
        if (!this.isExpanded)
        {
            this._resetForm();
        }
    }

    public increment(): void
    {
        this.status++;
        if (this.status > 3)
        {
            this.status = 0;
        }
    }

    public focusTitle(input: HTMLInputElement): void
    {
        input.focus();
    }

    public focusTitleViewChild(input: HTMLInputElement): void
    {
        this.titleInputEl.focus();
    }

    public handleSubmit(): void
    {
        if (!this.taskTitle.trim()) return;

        this.submit.emit({
            title: this.taskTitle.trim(),
            description: this.description.trim(),
            priority: this.priority,
            tags: this.parsedTags
        })
            .catch(console.error);

        this._resetForm();
        this.isExpanded = false;
    }

    public setPriority(p: TaskPriority): void
    {
        this.priority = p;
    }

    private _resetForm(): void
    {
        this.taskTitle = '';
        this.description = '';
        this.priority = 'medium';
        this.tagsInput = '';
    }
}
