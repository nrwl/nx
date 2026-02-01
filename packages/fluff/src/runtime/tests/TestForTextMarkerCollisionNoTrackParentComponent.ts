import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElementImpl.js';
import { MarkerManager } from '../MarkerManager.js';

export class TestForTextMarkerCollisionNoTrackParentComponent extends FluffElement
{
    private readonly __tags = new Property<string[]>({ initialValue: ['a', 'a'], propertyName: 'tags' });

    public get tags(): string[]
    {
        return this.__tags.getValue() ?? [];
    }

    public set tags(value: string[])
    {
        this.__tags.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:for:0-->
                    <!--/fluff:for:0-->
                    <template data-fluff-tpl="test-for-text-marker-collision-no-track-parent-0">
                        <span class="tag"><!--fluff:text:9--><!--/fluff:text:9--></span>
                    </template>
                `;

        this.__setMarkerConfigs(JSON.stringify([
            [0, { type: 'for', iterator: 'tag', iterableExprId: 0, deps: ['tags'], hasEmpty: false }],
            [9, { type: 'text', exprId: 1, deps: ['tag'] }]
        ]));
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
