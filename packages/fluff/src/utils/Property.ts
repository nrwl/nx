import { Direction } from '../enums/Direction.js';
import type { Subscription } from '../interfaces/Subscription.js';

import { Publisher } from '../utils/Publisher.js';

function safeStringify(obj: unknown): string
{
    const seen = new WeakSet();
    return JSON.stringify(obj, (_key, value: unknown) =>
    {
        if (typeof value === 'object' && value !== null)
        {
            if (seen.has(value))
            {
                return '[Circular]';
            }
            seen.add(value);
        }
        return value;
    });
}

export class Property<T>
{
    public readonly onChange = new Publisher<T>();
    public readonly onInboundChange = new Publisher<T>();
    public readonly onOutboundChange = new Publisher<T>();
    private value?: T;
    private committed = true;
    private _isChanging = false;

    public constructor(initialValue?: T)
    {
        this.value = initialValue;
    }

    public setValue(val: T, inbound = false, commit = true): void
    {
        if (this._isChanging)
        {
            throw new Error('Binding loop detected: setValue called while change is in progress');
        }

        const changed = val !== this.value && safeStringify(val) !== safeStringify(this.value);
        if (!changed) return;

        this._isChanging = true;
        try
        {
            this.value = val;
            this.onChange.emit(val)
                .catch((e: unknown) =>
                {
                    console.error(e);
                });

            if (!commit)
            {
                this.committed = false;
            }

            if (inbound)
            {
                this.committed = true;
                this.onInboundChange.emit(val)
                    .catch((e: unknown) =>
                    {
                        console.error(e);
                    });
            }
            else if (commit || !this.committed)
            {
                this.committed = true;
                if (this.value !== undefined)
                {
                    this.onOutboundChange.emit(this.value)
                        .catch((e: unknown) =>
                        {
                            console.error(e);
                        });
                }
            }
        }
        finally
        {
            this._isChanging = false;
        }
    }

    public async triggerChange(direction = Direction.Any): Promise<void>
    {
        if (this.value === undefined) return;
        await this.onChange.emit(this.value);
        if (direction == Direction.Outbound)
        {
            await this.onOutboundChange.emit(this.value);
        }
        if (direction == Direction.Inbound)
        {
            await this.onOutboundChange.emit(this.value);
        }
    }

    public subscribe(direction: Direction, cb: (val: T) => void): Subscription
    {
        if (direction == Direction.Inbound)
        {
            return this.onInboundChange.subscribe((val) =>
            {
                cb(val);
            });
        }
        else if (direction == Direction.Outbound)
        {
            return this.onOutboundChange.subscribe((val) =>
            {
                cb(val);
            });
        }
        else
        {
            return this.onChange.subscribe((val) =>
            {
                cb(val);
            });
        }
    }

    public getValue(): T | null
    {
        if (this.value === undefined)
        {
            return null;
        }
        return this.value;
    }
}