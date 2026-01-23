import { Component } from '@angular/core';
import { KanbanAppComponent } from './kanban-app/kanban-app.component';

@Component({
    imports: [KanbanAppComponent],
    selector: 'app-root',
    templateUrl: './app.html',
    styleUrl: './app.css',
})
export class App
{
    protected title = 'angular-demo-app';
}
