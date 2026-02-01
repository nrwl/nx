import { Component, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrl: './app.component.css',
})
export class AppComponent extends HTMLElement
{
    @Reactive()
    public pageTitle = 'fluff-demo-app';
}
