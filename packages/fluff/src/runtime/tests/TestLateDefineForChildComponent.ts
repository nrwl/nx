import { FluffElement } from '../FluffElement.js';

export class TestLateDefineForChildComponent extends FluffElement
{
    public column: unknown = null;

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = '<span>late-child</span>';
    }

    protected override __setupBindings(): void
    {
        super.__setupBindings();
    }
}
