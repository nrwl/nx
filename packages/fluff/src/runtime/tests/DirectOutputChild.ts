import { Publisher } from '../../utils/Publisher.js';
import { FluffElement } from '../FluffElementImpl.js';

export class DirectOutputChild extends FluffElement
{
    public readonly submit = new Publisher<{ value: string }>();

    protected override __render(): void
    {
        this.__getShadowRoot().innerHTML = '<button data-lid="l0">Submit</button>';
    }

    protected override __setupBindings(): void
    {
        super.__setupBindings();
    }

    public emitSubmit(value: string): void
    {
        this.submit.emit({ value });
    }
}
