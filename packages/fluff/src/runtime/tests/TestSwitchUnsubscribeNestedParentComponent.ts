import { Property } from '../../utils/Property.js';
import type { BindingInfo } from '../FluffBase.js';
import { MarkerManager } from '../MarkerManager.js';
import { TestUnsubscribeNestedParentBaseComponent } from './TestUnsubscribeNestedParentBaseComponent.js';

export class TestSwitchUnsubscribeNestedParentComponent extends TestUnsubscribeNestedParentBaseComponent
{
    private readonly __mode = new Property<string>({ initialValue: 'a', propertyName: 'mode' });

    public get mode(): string
    {
        return this.__mode.getValue() ?? 'a';
    }

    public set mode(value: string)
    {
        this.__mode.setValue(value);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = `
                    <!--fluff:switch:0-->
                    <!--/fluff:switch:0-->
                    <template data-fluff-case="test-switch-unsubscribe-nested-parent-0-0">
                        <test-unsubscribe-nested-child x-fluff-component data-lid="l0"></test-unsubscribe-nested-child>
                    </template>
                    <template data-fluff-case="test-switch-unsubscribe-nested-parent-0-1">
                        <div class="placeholder">placeholder</div>
                    </template>
                `;

        this.__setMarkerConfigs(JSON.stringify([
            [
                0, {
                type: 'switch', expressionExprId: 0, deps: ['mode'], cases: [
                    { valueExprId: 1, isDefault: false, fallthrough: false },
                    { valueExprId: 2, isDefault: false, fallthrough: false }
                ]
            }
            ]
        ]));

        const bindings: Record<string, BindingInfo[]> = {
            l0: [{ n: 'stats', b: 'property', e: 3, d: ['stats'] }]
        };

        Reflect.set(this.constructor, '__bindings', bindings);
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
