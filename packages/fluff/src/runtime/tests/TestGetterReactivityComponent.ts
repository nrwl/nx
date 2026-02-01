import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElement.js';
import { MarkerManager } from '../MarkerManager.js';

export class TestGetterReactivityComponent extends FluffElement
{
    private readonly __items = new Property<string[]>([]);

    public get items(): string[]
    {
        return this.__items.getValue() ?? [];
    }

    public set items(value: string[])
    {
        this.__items.setValue(value);
    }

    public get itemCount(): number
    {
        return this.items.length;
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <div class="count"><!--fluff:text:0--><!--/fluff:text:0--></div>
                `;

        this.__setMarkerConfigs(JSON.stringify([
            [0, { type: 'text', exprId: 0, deps: ['items'], pipes: [] }]
        ]));
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
