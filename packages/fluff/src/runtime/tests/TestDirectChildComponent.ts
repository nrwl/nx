import { FluffElement } from '../FluffElement.js';

export class TestDirectChildComponent extends FluffElement
{
    public value = '';

    protected __render(): void
    {
        this.__getShadowRoot().innerHTML = `<span class="value">${this.value}</span>`;
    }

    protected override __setupBindings(): void
    {
        super.__setupBindings();
    }
}
