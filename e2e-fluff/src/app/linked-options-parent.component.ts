import { Component, Reactive } from '@fluffjs/fluff';
import { LinkedOptionsDevice } from './linked-options-device.js';

@Component({
    selector: 'linked-options-parent',
    template: `
        <div>
            <div id="parent-raw">{{ rawCommitValue }}</div>
            <div id="parent-committed">{{ committedCommitValue }}</div>
            <button id="set-inbound-inbound" (click)="setInboundInbound(11)">Set Inbound Inbound</button>
            <button id="set-inbound-outbound" (click)="setInboundOutbound(22)">Set Inbound Outbound</button>
            <button id="set-outbound-inbound" (click)="setOutboundInbound(31)">Set Outbound Inbound</button>
            <button id="set-outbound-outbound" (click)="setOutboundOutbound(32)">Set Outbound Outbound</button>
            <linked-options-child
                [commitValue]="device.commitProp"
                [inboundValue]="device.inboundProp"
                [outboundValue]="device.outboundProp">
            </linked-options-child>
        </div>
    `
})
export class LinkedOptionsParentComponent extends HTMLElement
{
    public readonly device = new LinkedOptionsDevice();

    @Reactive()
    public rawCommitValue = 0;

    @Reactive()
    public committedCommitValue = 0;

    public constructor()
    {
        super();
        this.rawCommitValue = this.device.commitProp.getValue() ?? 0;
        this.committedCommitValue = this.device.commitProp.getValue() ?? 0;
        this.device.commitProp.onChange.subscribe((val) =>
        {
            this.rawCommitValue = val;
        });
        this.device.commitProp.onOutboundChange.subscribe((val) =>
        {
            this.committedCommitValue = val;
        });
    }

    public setInboundInbound(value: number): void
    {
        this.device.inboundProp.setValue(value, true);
    }

    public setInboundOutbound(value: number): void
    {
        this.device.inboundProp.setValue(value);
    }

    public setOutboundInbound(value: number): void
    {
        this.device.outboundProp.setValue(value, true);
    }

    public setOutboundOutbound(value: number): void
    {
        this.device.outboundProp.setValue(value);
    }
}
