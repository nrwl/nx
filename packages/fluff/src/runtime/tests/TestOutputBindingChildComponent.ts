import { Publisher } from '../../utils/Publisher.js';
import type { BindingInfo } from '../FluffBase.js';
import { FluffElement } from '../FluffElementImpl.js';
import { MarkerManager } from '../MarkerManager.js';

export class TestOutputBindingChildComponent extends FluffElement
{
    public edit = new Publisher<{ taskId: number }>();

    public onEdit(): void
    {
        this.edit.emit({ taskId: 42 });
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = '<button data-lid="l0">Edit</button>';

        const bindings: Record<string, BindingInfo[]> = {
            l0: [{ n: 'click', b: 'event', h: 1, d: ['onEdit'] }]
        };

        Reflect.set(this.constructor, '__bindings', bindings);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
