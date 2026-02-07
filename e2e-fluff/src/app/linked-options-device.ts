import { Property } from '@fluffjs/fluff';

export class LinkedOptionsDevice
{
    public readonly commitProp = new Property<number>({
        initialValue: 0,
        propertyName: 'commitProp'
    });

    public readonly inboundProp = new Property<number>({
        initialValue: 0,
        propertyName: 'inboundProp'
    });

    public readonly outboundProp = new Property<number>({
        initialValue: 0,
        propertyName: 'outboundProp'
    });
}
