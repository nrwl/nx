import type { Subscription } from '../interfaces/Subscription.js';
import type { Property } from '../utils/Property.js';
import type { Publisher } from '../utils/Publisher.js';

export abstract class FluffElement extends HTMLElement
{
    protected __pipes: Record<string, (value: unknown, ...args: unknown[]) => unknown> = {};
    private _subscriptions: Subscription[] = [];
    protected readonly _shadowRoot: ShadowRoot;
    private _initialized = false;

    public constructor()
    {
        super();
        this._shadowRoot = this.attachShadow({ mode: 'open' });
    }

    public connectedCallback(): void
    {
        if (!this._initialized)
        {
            this.__render();
            this.__setupBindings();
            this._initialized = true;

            if ('onInit' in this && typeof this.onInit === 'function')
            {
                this.onInit();
            }
        }
    }

    public disconnectedCallback(): void
    {
        if ('onDestroy' in this && typeof this.onDestroy === 'function')
        {
            this.onDestroy();
        }

        for (const sub of this._subscriptions)
        {
            sub.unsubscribe();
        }
        this._subscriptions = [];
    }

    protected abstract __render(): void;

    protected abstract __setupBindings(): void;

    protected __addSubscription(sub: Subscription): void
    {
        this._subscriptions.push(sub);
    }

    protected __pipe(name: string, value: unknown, ...args: unknown[]): unknown
    {
        const pipe = this.__pipes[name];
        if (!pipe)
        {
            console.warn(`Pipe "${name}" not found`);
            return value;
        }
        return pipe(value, ...args);
    }

    public override $watch = (_properties: string[], callback: () => void): Subscription =>
    {
        callback();
        return {
            unsubscribe: (): void =>
            {
            }
        };
    };

    protected __getShadowRoot(): ShadowRoot
    {
        return this._shadowRoot;
    }

    protected __getElement(id: string): Element | null
    {
        return this._shadowRoot.querySelector(`[data-lid="${id}"]`);
    }

    private isHTMLElement(el: Element | null): el is HTMLElement
    {
        return el !== null;
    }

    private isPublisher<T>(value: unknown): value is Publisher<T>
    {
        return typeof value === 'object' && value !== null && 'subscribe' in value && typeof (value as Record<string, unknown>).subscribe === 'function';
    }

    private isProperty(value: unknown): value is Property<unknown>
    {
        return typeof value === 'object' && value !== null && 'onChange' in value && 'setValue' in value;
    }

    protected __setText(id: string, text: string): void
    {
        const el = this.__getElement(id);
        if (el) el.textContent = text;
    }

    protected __bindText(id: string, getter: () => string): void
    {
        const el = this.__getElement(id);
        if (!el) return;

        const expr = el.getAttribute('data-text-bind') ?? '';
        const propMatch = /this\.([a-zA-Z_][a-zA-Z0-9_]*)/.exec(expr);

        const update = (): void =>
        {
            try
            {
                el.textContent = getter();
            }
            catch
            {
                el.textContent = '';
            }
        };

        if (propMatch)
        {
            const [, propName] = propMatch;
            const reactiveProp = this.__getReactiveProp(propName);
            if (reactiveProp)
            {
                this.__bindPropertyChange(reactiveProp, update);
            }
        }

        update();
    }

    protected __setProperty(id: string, prop: string, value: unknown): void
    {
        const el = this.__getElement(id);
        if (this.isHTMLElement(el))
        {
            if (prop in el)
            {
                Reflect.set(el, prop, value);
            }
            else
            {
                el.setAttribute(prop, String(value));
            }
        }
    }

    protected __addClass(id: string, className: string): void
    {
        const el = this.__getElement(id);
        if (this.isHTMLElement(el)) el.classList.add(className);
    }

    protected __removeClass(id: string, className: string): void
    {
        const el = this.__getElement(id);
        if (this.isHTMLElement(el)) el.classList.remove(className);
    }

    protected __bindEvent(id: string, event: string, handler: (e: Event) => void): void
    {
        const el = this.__getElement(id);
        if (el)
        {
            el.addEventListener(event, handler);
        }
    }

    protected __bindPropertyChange<T>(prop: Property<T>, callback: (val: T) => void): void
    {
        const sub = prop.onChange.subscribe(callback);
        this._subscriptions.push(sub);
        const currentVal = prop.getValue();
        if (currentVal !== null)
        {
            callback(currentVal);
        }
    }

    protected __connectProperties<T>(source: Property<T>, target: Property<T>): void
    {
        const sub = source.onChange.subscribe((val) =>
        {
            target.setValue(val, true);
        });
        this._subscriptions.push(sub);
        const currentVal = source.getValue();
        if (currentVal !== null)
        {
            target.setValue(currentVal, true);
        }
    }

    protected __connectOutput<T>(source: Publisher<T>, handler: (val: T) => void): void
    {
        const sub = source.subscribe(handler);
        this._subscriptions.push(sub);
    }

    protected __bindOutput(id: string, outputName: string, handler: (val: Event) => void): void
    {
        const el = this.__getElement(id);
        if (el) this.__bindOutputOnElement(el, outputName, handler);
    }

    protected __setChildProperty(el: Element, propName: string, value: unknown): void
    {
        const prop: unknown = Reflect.get(el, propName);

        if (this.isProperty(prop))
        {
            prop.setValue(value, true);
        }
        else if (propName in el)
        {
            Reflect.set(el, propName, value);
        }
        else
        {
            el.setAttribute(propName, String(value));
        }
    }

    protected __bindToChild(id: string, propName: string, value: unknown): void
    {
        const el = this.__getElement(id);
        if (!el) return;
        this.__setChildPropertyDeferred(el, propName, value);
    }

    protected __setChildPropertyDeferred(el: Element, propName: string, value: unknown): void
    {
        if (Reflect.get(el, propName) !== undefined)
        {
            this.__setChildProperty(el, propName, value);
            return;
        }

        const tagName = el.tagName.toLowerCase();
        if (tagName.includes('-'))
        {
            customElements.whenDefined(tagName)
                .then(() =>
                {
                    this.__setChildProperty(el, propName, value);
                })
                .catch((e: unknown) =>
                {
                    console.error(e);
                });
        }
        else
        {
            this.__setChildProperty(el, propName, value);
        }
    }

    protected __bindOutputOnElement(el: Element, outputName: string, handler: (val: Event) => void): void
    {
        const maybeOutput: unknown = Reflect.get(el, outputName);
        if (this.isPublisher<Event>(maybeOutput))
        {
            this.__connectOutput(maybeOutput, handler);
            return;
        }

        const tagName = el.tagName.toLowerCase();
        if (tagName.includes('-'))
        {
            customElements.whenDefined(tagName)
                .then(() =>
                {
                    const innerOutput: unknown = Reflect.get(el, outputName);
                    if (this.isPublisher<Event>(innerOutput))
                    {
                        this.__connectOutput(innerOutput, handler);
                    }
                    else
                    {
                        el.addEventListener(outputName, handler);
                    }
                })
                .catch((e: unknown) =>
                {
                    console.error(e);
                });
        }
        else
        {
            el.addEventListener(outputName, handler);
        }
    }

    protected __wireEvents(container: Element, attrPrefix: string): void
    {
        for (const el of Array.from(container.querySelectorAll(`[${attrPrefix}]`)))
        {
            const attr = el.getAttribute(attrPrefix);
            if (!attr) continue;

            const eventParts = attrPrefix.split('-event-');
            const [, eventPart] = eventParts;
            if (!eventPart) continue;
            const [baseEvent, ...modifiers] = eventPart.split('-');

            let handler: string = attr;
            if (attr.startsWith('['))
            {
                try
                {
                    const parsed: unknown = JSON.parse(attr);
                    if (Array.isArray(parsed) && typeof parsed[1] === 'string')
                    {
                        [, handler] = parsed;
                    }
                }
                catch
                {
                }
            }

            el.addEventListener(baseEvent, (ev: Event) =>
            {
                if (modifiers.length > 0 && ev instanceof KeyboardEvent)
                {
                    const keyEv = ev;
                    for (const mod of modifiers)
                    {
                        if (mod === 'enter' && keyEv.key !== 'Enter') return;
                        if (mod === 'escape' && keyEv.key !== 'Escape') return;
                        if (mod === 'space' && keyEv.key !== ' ') return;
                    }
                }
                const refLookups = this.__buildRefLookups(handler);
                // Dynamic event handlers are generated by the compiler from template attributes.
                // The Function constructor is required to execute these at runtime.
                // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-type-assertion
                const fn = Function('$event', refLookups + 'return this.' + handler)
                    .bind(this) as (e: Event) => void;
                fn(ev);
            });
        }
    }

    private __buildRefLookups(expr: string): string
    {
        const shadow = this._shadowRoot;
        const refEls = shadow.querySelectorAll('[data-ref]');
        let code = '';
        for (const el of Array.from(refEls))
        {
            const refName = el.getAttribute('data-ref');
            if (refName && new RegExp(`\\b${refName}\\b`).test(expr))
            {
                code += `const ${refName} = this._shadowRoot.querySelector('[data-ref="${refName}"]');`;
            }
        }
        return code;
    }

    private __getReactiveProp(propName: string): Property<unknown> | undefined
    {
        const key = `__${propName}`;
        if (key in this)
        {
            const candidate: unknown = Reflect.get(this, key);
            if (this.isProperty(candidate))
            {
                return candidate;
            }
        }
        return undefined;
    }
}
