import type { Subscription } from '../interfaces/Subscription.js';
import { DomUtils } from '../utils/DomUtils.js';
import { Property } from '../utils/Property.js';
import { Publisher } from '../utils/Publisher.js';
import { FluffBase } from './FluffBase.js';
import type { MarkerManagerInterface } from './MarkerManagerInterface.js';
import { getScope, type Scope } from './ScopeRegistry.js';

export abstract class FluffElement extends FluffBase
{
    protected __pipes: Record<string, (value: unknown, ...args: unknown[]) => unknown> = {};
    protected readonly _shadowRoot: ShadowRoot;
    private _subscriptions: Subscription[] = [];
    private _initialized = false;
    private _markerManager: MarkerManagerInterface | null = null;
    private _markerConfigJson: string | null = null;
    private _MarkerManagerClass: (new (host: FluffElement, shadowRoot: ShadowRoot) => MarkerManagerInterface) | null = null;

    public constructor()
    {
        super();
        this._shadowRoot = this.attachShadow({ mode: 'open' });
    }

    public connectedCallback(): void
    {
        if (!this._initialized)
        {
            const scopeId = this.getAttribute('data-fluff-scope-id');
            if (scopeId && !this.__parentScope)
            {
                this.__parentScope = getScope(scopeId);
                if (this.__parentScope)
                {
                    this.__loopContext = this.__parentScope.locals;
                }
            }

            const contextAttr = this.getAttribute('data-fluff-loop-context');
            if (contextAttr && Object.keys(this.__loopContext).length === 0)
            {
                try
                {
                    this.__loopContext = JSON.parse(contextAttr);
                }
                catch
                {
                }
            }

            this.__applyPendingProps();

            this.__render();
            this.__setupBindings();

            if (this.getAttribute('data-fluff-scope-id'))
            {
                this.__processBindings();
            }
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

        if (this._markerManager)
        {
            this._markerManager.cleanup();
            this._markerManager = null;
        }

        for (const sub of this._subscriptions)
        {
            sub.unsubscribe();
        }
        this._subscriptions = [];

        for (const sub of this.__baseSubscriptions)
        {
            sub.unsubscribe();
        }
        this.__baseSubscriptions = [];
    }

    public override $watch = (_properties: string[], callback: (changed: string) => void): Subscription =>
    {
        callback('');
        return {
            unsubscribe: (): void =>
            {
            }
        };
    };

    public __processBindingsOnElementPublic(el: HTMLElement, scope: Scope, subscriptions?: Subscription[]): void
    {
        this.__processBindingsOnElement(el, scope, subscriptions);
    }

    protected abstract __render(): void;

    protected __setupBindings(): void
    {
        this.__processBindings();
        this.__initializeMarkersInternal();
    }

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

    protected override __getPipeFn(name: string): ((value: unknown, ...args: unknown[]) => unknown) | undefined
    {
        return this.__pipes[name];
    }

    protected __getShadowRoot(): ShadowRoot
    {
        return this._shadowRoot;
    }

    protected __setMarkerConfigs(configJson: string): void
    {
        this._markerConfigJson = configJson;
    }

    protected __initializeMarkers(MarkerManagerClass: new (host: FluffElement, shadowRoot: ShadowRoot) => MarkerManagerInterface): void
    {
        this._MarkerManagerClass = MarkerManagerClass;
    }

    private __initializeMarkersInternal(): void
    {
        if (!this._markerConfigJson || !this._MarkerManagerClass) return;

        this._markerManager = new this._MarkerManagerClass(this, this._shadowRoot);
        this._markerManager.initializeFromConfig(this._markerConfigJson);
    }

    protected __getElement(id: string): Element | null
    {
        return this._shadowRoot.querySelector(`[data-lid="${id}"]`);
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

    protected override __setChildProperty(el: Element, propName: string, value: unknown): void
    {
        if (value instanceof Property)
        {
            value = value.getValue();
        }

        if (el instanceof HTMLElement && el.hasAttribute('x-fluff-component'))
        {
            const tagName = el.tagName.toLowerCase();
            if (customElements.get(tagName) === undefined)
            {
                this.__whenDefined(tagName, () =>
                {
                    this.__setChildProperty(el, propName, value);
                });
                return;
            }
        }

        const prop: unknown = Reflect.get(el, propName);

        if (prop instanceof Property)
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

        if (DomUtils.isCustomElement(el))
        {
            this.__whenDefined(el.tagName.toLowerCase(), () =>
            {
                this.__setChildProperty(el, propName, value);
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
        if (maybeOutput instanceof Publisher)
        {
            this.__connectOutput(maybeOutput, handler);
            return;
        }

        if (DomUtils.isCustomElement(el))
        {
            this.__whenDefined(el.tagName.toLowerCase(), () =>
            {
                const innerOutput: unknown = Reflect.get(el, outputName);
                if (innerOutput instanceof Publisher)
                {
                    this.__connectOutput(innerOutput, handler);
                }
                else
                {
                    el.addEventListener(outputName, handler);
                }
            });
        }
        else
        {
            el.addEventListener(outputName, handler);
        }
    }


    protected override __getReactivePropFromScope(propName: string, scope: Scope): Property<unknown> | undefined
    {
        const key = `__${propName}`;
        if (key in scope.host)
        {
            const candidate: unknown = Reflect.get(scope.host, key);
            if (candidate instanceof Property)
            {
                return candidate;
            }
        }
        if (scope.parent)
        {
            return this.__getReactivePropFromScope(propName, scope.parent);
        }
        return undefined;
    }

    protected __processBindings(): void
    {
        const elements = this._shadowRoot.querySelectorAll('[data-lid]');
        const scope = this.__getScope();
        for (const el of Array.from(elements))
        {
            const closestComponent = el.closest('[x-fluff-component]');
            if (closestComponent && closestComponent !== el) continue;
            if (el instanceof HTMLElement)
            {
                this.__processBindingsOnElement(el, scope);
            }
        }
    }


    private __applyPendingProps(): void
    {
        const existing: unknown = Reflect.get(this, '__pendingProps');
        if (!this.isRecord(existing))
        {
            return;
        }
        for (const [propName, value] of Object.entries(existing))
        {
            console.log('apply-pending-prop', { propName, value, el: this.tagName });
            const key = `__${propName}`;
            if (key in this)
            {
                const prop: unknown = Reflect.get(this, key);
                if (prop instanceof Property)
                {
                    prop.setValue(value, true);
                }
            }
            else if (propName in this)
            {
                Reflect.set(this, propName, value);
            }
        }

        Reflect.deleteProperty(this, '__pendingProps');
    }

    private isHTMLElement(el: Element | null): el is HTMLElement
    {
        return el !== null;
    }

    private isRecord(value: unknown): value is Record<string, unknown>
    {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }


    private __getReactiveProp(propName: string): Property<unknown> | undefined
    {
        const key = `__${propName}`;
        if (key in this)
        {
            const candidate: unknown = Reflect.get(this, key);
            if (candidate instanceof Property)
            {
                return candidate;
            }
        }
        return undefined;
    }
}
