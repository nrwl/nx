import { Property as PropertyImpl } from '../../utils/Property.js';
import { FluffElement } from '../FluffElement.js';
import { MarkerManager } from '../MarkerManager.js';

export interface TestTask
{
    title: string;
}

export class TestNullInputTextComponent extends FluffElement
{
    private readonly __isEditing = new PropertyImpl<boolean>(false);
    private readonly __task = new PropertyImpl<TestTask | null>(null);

    public get isEditing(): boolean
    {
        return this.__isEditing.getValue() ?? false;
    }

    public set isEditing(value: boolean)
    {
        this.__isEditing.setValue(value);
    }

    public get task(): TestTask | null
    {
        return this.__task.getValue() ?? null;
    }

    public set task(value: TestTask | null)
    {
        this.__task.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:if:0-->
                    <!--/fluff:if:0-->
                    <template data-fluff-branch="test-null-input-text-0-0">
                        <div class="title"><!--fluff:text:1--><!--/fluff:text:1--></div>
                    </template>
                    <template data-fluff-branch="test-null-input-text-0-1"></template>
                `;

        this.__setMarkerConfigs(JSON.stringify([
            [0, { type: 'if', branches: [{ exprId: 0, deps: ['isEditing'] }, { exprId: undefined, deps: [] }] }],
            [1, { type: 'text', exprId: 1, deps: ['task'], pipes: [] }]
        ]));
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
