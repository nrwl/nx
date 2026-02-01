import { Property } from '../../utils/Property.js';
import type { BindingInfo } from '../FluffBase.js';
import { MarkerManager } from '../MarkerManager.js';
import { TestUnsubscribeNestedParentBaseComponent } from './TestUnsubscribeNestedParentBaseComponent.js';

export class TestForUnsubscribeNestedParentComponent extends TestUnsubscribeNestedParentBaseComponent
{
    private readonly __items = new Property<number[]>({ initialValue: [0], propertyName: 'items' });

    public get items(): number[]
    {
        return this.__items.getValue() ?? [];
    }

    public set items(value: number[])
    {
        this.__items.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:for:0-->
                    <!--/fluff:for:0-->
                    <template data-fluff-tpl="test-for-unsubscribe-nested-parent-0">
                        <test-unsubscribe-nested-child x-fluff-component data-lid="l0"></test-unsubscribe-nested-child>
                    </template>
                    <template data-fluff-empty="test-for-unsubscribe-nested-parent-0">
                        <div class="empty">empty</div>
                    </template>
                `;

        this.__setMarkerConfigs(JSON.stringify([
            [0, { type: 'for', iterator: 'item', iterableExprId: 0, deps: ['items'], hasEmpty: true }]
        ]));

        const bindings: Record<string, BindingInfo[]> = {
            l0: [{ n: 'stats', b: 'property', e: 1, d: ['stats'] }]
        };

        Reflect.set(this.constructor, '__bindings', bindings);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
