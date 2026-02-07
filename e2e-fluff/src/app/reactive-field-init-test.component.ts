import { Component, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'reactive-field-init-test',
    template: `
        <div id="items-count">{{ itemsCount }}</div>
        <div id="derived-value">{{ derivedValue }}</div>
    `
})
export class ReactiveFieldInitTestComponent extends HTMLElement
{
    @Reactive() items: string[] = ['a', 'b', 'c'];

    derivedValue = this.items.length * 10;

    get itemsCount(): number
    {
        return this.items.length;
    }
}
