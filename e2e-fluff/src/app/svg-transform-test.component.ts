import { Component, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'svg-transform-test',
    template: `
        <svg width="100" height="100">
            <g id="test-group" [transform]="'rotate(' + rotation + ',50,50)'">
                <rect x="40" y="10" width="20" height="30" fill="red"></rect>
            </g>
        </svg>
    `
})
export class SvgTransformTestComponent extends HTMLElement
{
    @Reactive() public rotation = 45;
}
