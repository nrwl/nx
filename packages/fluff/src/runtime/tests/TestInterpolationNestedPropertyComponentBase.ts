import { Property } from '../../utils/Property.js';
import { FluffElement } from '../FluffElement.js';
import { MarkerManager } from '../MarkerManager.js';
import { TestInterpolationNestedPropertyContainerClass } from './TestInterpolationNestedPropertyContainerClass.js';

export abstract class TestInterpolationNestedPropertyComponentBase extends FluffElement
{
    public __hostClass = new Property<TestInterpolationNestedPropertyContainerClass>({
        initialValue: new TestInterpolationNestedPropertyContainerClass(),
        propertyName: 'hostClass'
    });

    public get hostClass(): TestInterpolationNestedPropertyContainerClass
    {
        const val = this.__hostClass.getValue();
        if (!val)
        {
            throw new Error('hostClass is null');
        }
        return val;
    }

    public set hostClass(val: TestInterpolationNestedPropertyContainerClass)
    {
        this.__hostClass.setValue(val);
    }

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = '<!--fluff:text:0--><!--/fluff:text:0-->';

        this.__setMarkerConfigs(JSON.stringify([
            [0, { type: 'text', exprId: 0, deps: [['hostClass', 'childProp']], pipes: [] }]
        ]));
    }

    protected override __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        super.__setupBindings();
    }
}
