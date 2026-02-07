import { Component, HostListener, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'global-listener-test',
    template: `
        <div id="mousemove-result">{{ moveCount }}</div>
        <div id="click-result">{{ clickCount }}</div>
    `
})
export class GlobalListenerTestComponent extends HTMLElement
{
    @Reactive() public moveCount = 0;
    @Reactive() public clickCount = 0;

    @HostListener('document:mousemove')
    public onDocumentMouseMove(): void
    {
        this.moveCount++;
    }

    @HostListener('document:click')
    public onDocumentClick(): void
    {
        this.clickCount++;
    }
}
