import { Component, Direction, Input, Reactive } from '@fluffjs/fluff';

@Component({
    selector: 'linked-options-child',
    template: `
        <div>
            <div id="child-mouse-up">{{ mouseUp }}</div>
            <div id="child-commit-value">{{ commitValue }}</div>
            <div id="child-inbound-value">{{ inboundValue }}</div>
            <div id="child-outbound-value">{{ outboundValue }}</div>
            <button id="toggle-mouse-up" (click)="toggleMouseUp()">Toggle MouseUp</button>
            <button id="set-commit-1" (click)="setCommitValue(1)">Set Commit 1</button>
            <button id="set-commit-2" (click)="setCommitValue(2)">Set Commit 2</button>
        </div>
    `
})
export class LinkedOptionsChildComponent extends HTMLElement
{
    @Reactive()
    public mouseUp = false;

    @Input({ commitTrigger: 'mouseUp' })
    public commitValue: number | null = null;

    @Input({ direction: Direction.Inbound })
    public inboundValue: number | null = null;

    @Input({ direction: Direction.Outbound })
    public outboundValue: number | null = null;

    public setCommitValue(value: number): void
    {
        this.commitValue = value;
    }

    public toggleMouseUp(): void
    {
        this.mouseUp = !this.mouseUp;
    }
}
