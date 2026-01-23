import { Component, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'hello-world',
    templateUrl: './hello-world.component.html',
    styleUrl: './hello-world.component.css'
})
export class HelloWorldComponent extends HTMLElement
{
    @Reactive() public name = 'World';
    @Reactive() public count = 0;

    public increment(): void
    {
        this.count++;
    }
}
