import { getPipeTransform } from '../decorators/Pipe.js';
import type { Subscription } from '../interfaces/Subscription.js';
import { Property } from '../utils/Property.js';
import { FluffBase } from './FluffBase.js';
import { MarkerManager } from './MarkerManager.js';
import type { MarkerConfigEntries, MarkerManagerInterface } from './MarkerManagerInterface.js';
import { getScope, type Scope } from './ScopeRegistry.js';

export abstract class FluffElement extends FluffBase
{
    protected __pipes: Record<string, (value: unknown, ...args: unknown[]) => unknown> = {};
    protected readonly _shadowRoot: ShadowRoot;
    private _subscriptions: Subscription[] = [];
    private _initialized = false;
    private _pendingInit = false;
    private _markerManager: MarkerManagerInterface | null = null;
    private _markerConfigEntries: MarkerConfigEntries | null = null;
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
            if (!FluffBase.__areExpressionsReady())
            {
                if (!this._pendingInit)
                {
                    this._pendingInit = true;
                    FluffBase.__addPendingInit((): void =>
                    {
                        this._pendingInit = false;
                        this.connectedCallback();
                    });
                }
                return;
            }

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

    public __processBindingsOnElementPublic(el: Element, scope: Scope, subscriptions?: Subscription[]): void
    {
        this.__processBindingsOnElement(el, scope, subscriptions);
    }

    protected abstract __render(): void;

    protected __setupBindings(): void
    {
        this.__initializeMarkers(MarkerManager);
        this.__processBindings();
        this.__initializeMarkersInternal();
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
        return this.__pipes[name] ?? getPipeTransform(name);
    }

    protected __getShadowRoot(): ShadowRoot
    {
        return this._shadowRoot;
    }

    protected __createProp<T>(name: string, options: T | { initialValue: T; [key: string]: unknown }): Property<T>
    {
        const prop = new Property<T>(options);
        Object.defineProperty(this, name, {
            get(): T | null
            {
                return prop.getValue();
            },
            set(v: T): void
            {
                prop.setValue(v);
            },
            enumerable: true,
            configurable: true
        });
        return prop;
    }

    protected __defineClassHostBinding(name: string, className: string, privateName: string): void
    {
        Object.defineProperty(this, name, {
            get: (): boolean => Boolean(Reflect.get(this, privateName)),
            set: (v: boolean): void =>
            {
                Reflect.set(this, privateName, v);
                if (v)
                {
                    this.classList.add(className);
                }
                else
                {
                    this.classList.remove(className);
                }
            },
            enumerable: true,
            configurable: true
        });
    }

    protected __setMarkerConfigs(entries: MarkerConfigEntries): void
    {
        this._markerConfigEntries = entries;
    }

    protected __initializeMarkers(MarkerManagerClass: new (host: FluffElement, shadowRoot: ShadowRoot) => MarkerManagerInterface): void
    {
        this._MarkerManagerClass = MarkerManagerClass;
    }

    private __initializeMarkersInternal(): void
    {
        if (!this._markerConfigEntries || !this._MarkerManagerClass) return;

        this._markerManager = new this._MarkerManagerClass(this, this._shadowRoot);
        this._markerManager.initializeFromConfig(this._markerConfigEntries);
    }

    protected override __setChildProperty(el: Element, propName: string, value: unknown): void
    {
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

        super.__setChildProperty(el, propName, value);
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
            this.__processBindingsOnElement(el, scope);
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

    private isRecord(value: unknown): value is Record<string, unknown>
    {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }


}
