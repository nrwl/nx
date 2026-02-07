import { Component, HostBinding, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'hostbinding-test',
    template: `
        <button id="hostbinding-btn" (click)="toggleActive()">Toggle</button>
        <div id="hostbinding-status">{{ isActive ? 'active' : 'inactive' }}</div>
    `
})
export class HostBindingTestComponent extends HTMLElement
{
    @Reactive() public isActive = false;

    @HostBinding('class.is-active')
    public get activeClass(): boolean
    {
        return this.isActive;
    }

    @HostBinding('attr.data-state')
    public get dataState(): string
    {
        return this.isActive ? 'on' : 'off';
    }

    public toggleActive(): void
    {
        this.isActive = !this.isActive;
    }
}
