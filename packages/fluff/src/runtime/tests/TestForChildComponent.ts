import { FluffElement } from '../FluffElement.js';

export class TestForChildComponent extends FluffElement
{
    public value = '';

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = '<span>child</span>';
    }

    protected override __setupBindings(): void
    {
        super.__setupBindings();
    }
}
