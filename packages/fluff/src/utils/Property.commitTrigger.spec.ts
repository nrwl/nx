import { describe, expect, it } from 'vitest';
import { Property } from './Property.js';

describe('Property commitTrigger', () =>
{
    it('should not emit onOutboundChange when commitTrigger is false', () =>
    {
        const trigger = new Property<boolean>({ initialValue: false });
        const grandparent = new Property<number>({ initialValue: 0 });
        const parent = new Property<number>({ initialValue: 0 });
        const child = new Property<number>({ initialValue: 0 });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        child.setCommitTrigger(trigger as Property<unknown>);
        parent.setValue(grandparent);
        child.setValue(parent);

        let outboundCount = 0;
        grandparent.onOutboundChange.subscribe(() =>
        {
            outboundCount++;
        });

        child.setValue(42);

        expect(outboundCount).toBe(0);
        expect(grandparent.getValue()).toBe(42);
    });

    it('should emit onOutboundChange when commitTrigger becomes true', () =>
    {
        const trigger = new Property<boolean>({ initialValue: false });
        const grandparent = new Property<number>({ initialValue: 0 });
        const parent = new Property<number>({ initialValue: 0 });
        const child = new Property<number>({ initialValue: 0 });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
        child.setCommitTrigger(trigger as Property<unknown>);
        parent.setValue(grandparent);
        child.setValue(parent);

        let outboundCount = 0;
        grandparent.onOutboundChange.subscribe(() =>
        {
            outboundCount++;
        });

        child.setValue(42);
        expect(outboundCount).toBe(0);

        trigger.setValue(true);
        expect(outboundCount).toBe(1);
    });
});
