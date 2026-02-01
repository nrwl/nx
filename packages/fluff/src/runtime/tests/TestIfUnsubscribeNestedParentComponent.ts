import { Property } from '../../utils/Property.js';
import type { BindingInfo } from '../FluffBase.js';
import { MarkerManager } from '../MarkerManager.js';
import { TestUnsubscribeNestedParentBaseComponent } from './TestUnsubscribeNestedParentBaseComponent.js';

export class TestIfUnsubscribeNestedParentComponent extends TestUnsubscribeNestedParentBaseComponent
{
    private readonly __show = new Property<boolean>({ initialValue: true, propertyName: 'show' });

    public get show(): boolean
    {
        return this.__show.getValue() ?? false;
    }

    public set show(value: boolean)
    {
        this.__show.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:if:0-->
                    <!--/fluff:if:0-->
                    <template data-fluff-branch="test-if-unsubscribe-nested-parent-0-0">
                        <test-unsubscribe-nested-child x-fluff-component data-lid="l0"></test-unsubscribe-nested-child>
                    </template>
                `;

        this.__setMarkerConfigs(JSON.stringify([
            [0, { type: 'if', branches: [{ exprId: 0, deps: ['show'] }] }]
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
