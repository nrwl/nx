import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElementImpl.js';
import { MarkerManager } from '../MarkerManager.js';

export class TestForTextMarkerCollisionParentComponent extends FluffElement
{
    private readonly __tags = new Property<string[]>({ initialValue: ['docs', 'api'], propertyName: 'tags' });

    public override __pipes: Record<string, (v: unknown, ...args: unknown[]) => unknown> = {
        lowercase: (v: unknown): string => String(v)
            .toLowerCase(),
        capitalize: (v: unknown): string =>
        {
            const str = String(v);
            return str.charAt(0)
                .toUpperCase() + str.slice(1)
                .toLowerCase();
        }
    };

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
                    <template data-fluff-tpl="test-for-text-marker-collision-parent-0">
                        <span class="tag"><!--fluff:text:9--><!--/fluff:text:9--></span>
                    </template>
                `;

        this.__setMarkerConfigs(JSON.stringify([
            [0, { type: 'for', iterator: 'tag', iterableExprId: 0, deps: ['tags'], trackBy: 'tag', hasEmpty: false }],
            [9,
                {
                    type: 'text',
                    exprId: 1,
                    deps: ['tag'],
                    pipes: [{ name: 'lowercase', argExprIds: [] }, { name: 'capitalize', argExprIds: [] }]
                }
            ]
        ]));
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
