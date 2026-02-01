import type { Subscription } from '../interfaces/Subscription.js';

type Callback<T> = (value: T) => void | Promise<void>;

export class Publisher<T>
{
    private readonly callbacks = new Set<Callback<T>>();

    public emit(value: T): void
    {
        for (const callback of this.callbacks)
        {
            try
            {
                const result = callback(value);
                if (result instanceof Promise)
                {
                    result.catch((e: unknown) =>
                    {
                        console.error(e);
                    });
                }
            }
            catch(e: unknown)
            {
                console.error(e);
            }
        }
    }

    public async emitAsync(value: T): Promise<void>
    {
        for (const callback of this.callbacks)
        {
            try
            {
                await callback(value);
            }
            catch(e: unknown)
            {
                console.error(e);
            }
        }
    }

    public subscribe(callback: Callback<T>): Subscription
    {
        this.callbacks.add(callback);

        return {
            unsubscribe: (): void =>
            {
                this.callbacks.delete(callback);
            },
        };
    }

    public subscribeOnce(callback: Callback<T>): Subscription
    {
        const wrappedCallback: Callback<T> = async(value: T): Promise<void> =>
        {
            this.callbacks.delete(wrappedCallback);
            await callback(value);
        };

        this.callbacks.add(wrappedCallback);

        return {
            unsubscribe: (): void =>
            {
                this.callbacks.delete(wrappedCallback);
            },
        };
    }
}