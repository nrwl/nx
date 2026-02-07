import { Component, Reactive, Watch } from '@fluffjs/fluff';

@Component({
    selector: 'watch-test',
    template: `
        <input id="watch-input" type="text" [value]="inputText" (input)="onInput($event)" />
        <div id="watch-result">{{ watchCount }}</div>
    `
})
export class WatchTestComponent extends HTMLElement
{
    @Reactive() public inputText = '';
    @Reactive() public watchCount = 0;

    @Watch('inputText')
    public onInputTextChange(): void
    {
        this.watchCount++;
    }

    public onInput(event: Event): void
    {
        this.inputText = (event.target as HTMLInputElement).value;
    }
}
