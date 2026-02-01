import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElement.js';
import { MarkerManager } from '../MarkerManager.js';

export class TestTemplateNestedMarkersComponent extends FluffElement
{
    private readonly __show = new Property<boolean>(true);
    private readonly __text = new Property<string>('Hello');

    public get show(): boolean
    {
        return this.__show.getValue() ?? false;
    }

    public set show(value: boolean)
    {
        this.__show.setValue(value);
    }

    public get text(): string
    {
        return this.__text.getValue() ?? '';
    }

    public set text(value: string)
    {
        this.__text.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:if:0-->
                    <!--/fluff:if:0-->
                    <template data-fluff-branch="test-template-nested-markers-0-0">
                        <div class="title"><!--fluff:text:1--><!--/fluff:text:1--></div>
                    </template>
                    <template data-fluff-branch="test-template-nested-markers-0-1">
                        <div class="fallback">Fallback</div>
                    </template>
                `;

        this.__setMarkerConfigs(JSON.stringify([
            [0, { type: 'if', branches: [{ exprId: 0, deps: ['show'] }, { exprId: undefined, deps: [] }] }],
            [1, { type: 'text', exprId: 1, deps: ['text'], pipes: [] }]
        ]));
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
