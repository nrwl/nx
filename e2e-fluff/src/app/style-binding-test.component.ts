import { Component, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'style-binding-test',
    template: `
        <div id="test-div" [style.background-color]="bgColor">
            Test content
        </div>
    `
})
export class StyleBindingTestComponent extends HTMLElement
{
    @Reactive() public bgColor = 'rgb(255, 0, 0)';
}
