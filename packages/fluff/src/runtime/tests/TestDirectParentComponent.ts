import { FluffElement } from '../FluffElement.js';

export class TestDirectParentComponent extends FluffElement
{
    public itemName = 'test-item';

    protected __render(): void
    {
        this.__getShadowRoot().innerHTML = '<test-direct-child data-lid="l0" x-fluff-component></test-direct-child>';
    }

    protected override __setupBindings(): void
    {
        super.__setupBindings();
    }
}
