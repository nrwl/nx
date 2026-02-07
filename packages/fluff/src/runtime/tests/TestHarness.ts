import { FluffBase, type ExpressionFn, type HandlerFn } from '../FluffBase.js';

export class TestHarness
{
    public static setExpressionTable(expressions: ExpressionFn[], handlers: HandlerFn[]): void
    {
        FluffBase.__setExpressionTable(expressions, handlers);
    }

    public static resetExpressionTable(): void
    {
        FluffBase.__setExpressionTable([], []);
    }

    public static defineCustomElement(tag: string, ctor: CustomElementConstructor): void
    {
        if (!customElements.get(tag))
        {
            customElements.define(tag, ctor);
        }
    }

    public static mount(tag: string): HTMLElement
    {
        const el = document.createElement(tag);
        document.body.appendChild(el);
        return el;
    }

    public static async tick(count = 1): Promise<void>
    {
        for (let i = 0; i < count; i++)
        {
            await Promise.resolve();
        }
    }

    public static async waitForTimeout(): Promise<void>
    {
        await new Promise<void>((resolve) =>
        {
            setTimeout(resolve, 0);
        });
    }
}
