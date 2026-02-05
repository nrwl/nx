import { Direction } from '../enums/Direction.js';
import type { Subscription } from '../interfaces/Subscription.js';

import { Publisher } from './Publisher.js';

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
    public readonly onMetadataChange = new Publisher<T>();
    private value?: T;
    private committed = true;
    private _isChanging = false;
    private readonly _propName?: string;
    private _parentProperty?: Property<T>;
    private _parentSubscription?: Subscription;

    public constructor(options: {
        initialValue: T,
        propertyName?: string
    } | T)
    {
        if (this.isOptionsObject(options))
        {
            if (options.initialValue !== undefined)
            {
                this.value = options.initialValue;
            }
            if (options.propertyName !== undefined)
            {
                this._propName = options.propertyName;
            }
        }
        else
        {
            this.value = options;
        }
    }

    public prop(): Property<T> | undefined
    {
        return this._parentProperty;
    }

    public setValue(val: T | Property<T>, inbound = false, commit = true): void
    {
        if (val instanceof Property)
        {
            this.linkToParent(val);
            return;
        }

        if (this._isChanging)
        {
            console.error((this._propName ? this._propName + ': ' : '') + 'Binding loop detected: setValue called while change is in progress');
            return;
        }

        const changed = val !== this.value && safeStringify(val) !== safeStringify(this.value);
        if (!changed) return;

        this._isChanging = true;
        try
        {
            this.value = val;
            this.onChange.emit(val);

            if (!commit)
            {
                this.committed = false;
            }

            if (inbound)
            {
                this.committed = true;
                this.onInboundChange.emit(val);
            }
            else if (commit || !this.committed)
            {
                this.committed = true;
                if (this.value !== undefined)
                {
                    this.onOutboundChange.emit(this.value);
                }
            }

            if (!inbound && this._parentProperty)
            {
                this.pushToParent(val);
            }
        }
        finally
        {
            this._isChanging = false;
        }
    }

    private linkToParent(source: Property<T>): void
    {
        this.clearParentLink();

        let root: Property<T> = source;
        while (root._parentProperty)
        {
            root = root._parentProperty;
        }

        this._parentProperty = root;
        this._parentSubscription = root.subscribe(Direction.Any, (val) =>
        {
            this.setValueInternal(val, true);
        });

        const currentValue = root.getValue();
        if (currentValue !== null)
        {
            this.setValueInternal(currentValue, true);
        }
    }

    private setValueInternal(val: T, inbound: boolean): void
    {
        if (this._isChanging) return;

        const changed = val !== this.value && safeStringify(val) !== safeStringify(this.value);
        if (!changed) return;

        this._isChanging = true;
        try
        {
            this.value = val;
            this.onChange.emit(val);
            if (inbound)
            {
                this.onInboundChange.emit(val);
            }
        }
        finally
        {
            this._isChanging = false;
        }
    }

    private pushToParent(val: T): void
    {
        if (!this._parentProperty) return;

        const sub = this._parentSubscription;
        this._parentSubscription = undefined;
        sub?.unsubscribe();

        this._parentProperty.setValue(val);

        this._parentSubscription = this._parentProperty.subscribe(Direction.Any, (v) =>
        {
            this.setValueInternal(v, true);
        });
    }

    private clearParentLink(): void
    {
        if (this._parentSubscription)
        {
            this._parentSubscription.unsubscribe();
            this._parentSubscription = undefined;
        }
        this._parentProperty = undefined;
    }

    public reset(): void
    {
        this.clearParentLink();
    }

    public triggerChange(direction = Direction.Any): void
    {
        if (this.value === undefined) return;
        this.onChange.emit(this.value);
        if (direction == Direction.Outbound)
        {
            this.onOutboundChange.emit(this.value);
        }
        if (direction == Direction.Inbound)
        {
            this.onOutboundChange.emit(this.value);
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

    private isOptionsObject(options: { initialValue?: T, propertyName?: string } | T):
        options is { initialValue?: T, propertyName?: string }
    {
        return typeof options === 'object' && options !== null && ('initialValue' in options);
    }
}