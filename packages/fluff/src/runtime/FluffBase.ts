import type { PropertyChain } from '../interfaces/PropertyChain.js';
import type { Subscription } from '../interfaces/Subscription.js';
import { DomUtils } from '../utils/DomUtils.js';
import { Property } from '../utils/Property.js';
import { Publisher } from '../utils/Publisher.js';
import type { Scope } from './ScopeRegistry.js';

export type ExpressionFn = (t: unknown, l: Record<string, unknown>) => unknown;
export type HandlerFn = (t: unknown, l: Record<string, unknown>, e: unknown) => void;

export interface BindingInfo
{
    n: string;
    b: 'property' | 'event' | 'two-way' | 'class' | 'style' | 'ref';
    e?: number;
    h?: number;
    t?: string;
    d?: PropertyChain[];
    s?: string;
    p?: { n: string; a: number[] }[];
}

export abstract class FluffBase extends HTMLElement
{
    public static __e: ExpressionFn[] = [];
    public static __h: HandlerFn[] = [];
    public static __bindings: Record<string, BindingInfo[]> = {};

    public __parentScope?: Scope;
    public __loopContext: Record<string, unknown> = {};
    protected __baseSubscriptions: Subscription[] = [];

    public __getScope(): Scope
    {
        return {
            host: this,
            locals: this.__loopContext,
            parent: this.__parentScope
        };
    }

    protected __processBindingsOnElement(el: HTMLElement, scope: Scope, subscriptions?: Subscription[]): void
    {
        const lid = el.getAttribute('data-lid');
        if (!lid) return;

        const bindings = this.__getBindingsForLid(lid);
        if (!bindings || bindings.length === 0) return;

        for (const binding of bindings)
        {
            this.__applyBindingWithScope(el, binding, scope, subscriptions);
        }
    }

    private __getBindingsForLid(lid: string): BindingInfo[] | undefined
    {
        const ctor: unknown = this.constructor;
        if (typeof ctor === 'function')
        {
            const bindings = Reflect.get(ctor, '__bindings') as unknown;
            if (this.__isBindingsMap(bindings))
            {
                return bindings[lid];
            }
        }
        return undefined;
    }

    private __isBindingsMap(value: unknown): value is Record<string, BindingInfo[]>
    {
        return !(!value || typeof value !== 'object');

    }

    protected __applyBindingWithScope(el: HTMLElement, binding: BindingInfo, scope: Scope, subscriptions?: Subscription[]): void
    {
        switch (binding.b)
        {
            case 'property':
                this.__applyPropertyBindingWithScope(el, binding, scope, subscriptions);
                break;
            case 'event':
                this.__applyEventBindingWithScope(el, binding, scope);
                break;
            case 'two-way':
                this.__applyTwoWayBindingWithScope(el, binding, scope, subscriptions);
                break;
            case 'class':
                this.__applyClassBindingWithScope(el, binding, scope, subscriptions);
                break;
            case 'style':
                this.__applyStyleBindingWithScope(el, binding, scope, subscriptions);
                break;
            case 'ref':
                break;
        }
    }

    protected __getCompiledExprFn(exprId: number): ExpressionFn
    {
        const fn = FluffBase.__e[exprId];
        if (typeof fn !== 'function')
        {
            throw new Error(`Missing compiled expression function for exprId ${exprId}`);
        }
        return fn;
    }

    protected __getCompiledHandlerFn(handlerId: number): HandlerFn
    {
        const fn = FluffBase.__h[handlerId];
        if (typeof fn !== 'function')
        {
            throw new Error(`Missing compiled handler function for handlerId ${handlerId}`);
        }
        return fn;
    }

    protected __applyPipes(value: unknown, pipes: {
        n: string;
        a: number[]
    }[], locals: Record<string, unknown>): unknown
    {
        let result = value;
        for (const pipe of pipes)
        {
            result = this.__applyPipe(pipe.n, result, pipe.a, locals);
        }
        return result;
    }

    private __applyPipe(name: string, value: unknown, argExprIds: number[], locals: Record<string, unknown>): unknown
    {
        const pipeFn = this.__getPipeFn(name);
        if (!pipeFn)
        {
            console.warn(`Pipe "${name}" not found`);
            return value;
        }
        const args = argExprIds.map(id => this.__getCompiledExprFn(id)(this, locals));
        return pipeFn(value, ...args);
    }

    protected __getPipeFn(_name: string): ((value: unknown, ...args: unknown[]) => unknown) | undefined
    {
        return undefined;
    }

    protected __subscribeToExpressionInScope(deps: PropertyChain[] | undefined, scope: Scope, callback: () => void, subscriptions?: Subscription[]): void
    {
        if (!deps) return;

        const addSub = (sub: Subscription): void =>
        {
            if (subscriptions)
            {
                subscriptions.push(sub);
            }
            else
            {
                this.__baseSubscriptions.push(sub);
            }
        };

        for (const dep of deps)
        {
            if (Array.isArray(dep))
            {
                this.__subscribeToPropertyChain(dep, scope, callback, addSub);
            }
            else
            {
                const reactiveProp = this.__getReactivePropFromScope(dep, scope);
                if (reactiveProp)
                {
                    addSub(reactiveProp.onChange.subscribe(callback));
                }
                else if (!(dep in scope.locals) && !(dep in scope.host))
                {
                    console.warn(`Binding dependency "${dep}" not found on component ${scope.host.constructor.name}`);
                }
            }
        }
    }

    private __subscribeToPropertyChain(chain: string[], scope: Scope, callback: () => void, addSub: (sub: Subscription) => void): void
    {
        if (chain.length === 0) return;

        const [first, ...rest] = chain;

        const reactiveProp = this.__getReactivePropFromScope(first, scope);
        if (reactiveProp)
        {
            if (rest.length === 0)
            {
                addSub(reactiveProp.onChange.subscribe(callback));
            }
            else
            {
                let nestedSubs: Subscription[] = [];

                const resubscribeNested = (): void =>
                {
                    for (const sub of nestedSubs)
                    {
                        sub.unsubscribe();
                    }
                    nestedSubs = [];

                    const currentValue: unknown = reactiveProp.getValue();
                    if (currentValue !== null && currentValue !== undefined)
                    {
                        this.__subscribeToNestedChain(currentValue, rest, callback, (sub) =>
                        {
                            nestedSubs.push(sub);
                            addSub(sub);
                        });
                    }

                    callback();
                };

                addSub(reactiveProp.onChange.subscribe(resubscribeNested));

                const currentValue: unknown = reactiveProp.getValue();
                if (currentValue !== null && currentValue !== undefined)
                {
                    this.__subscribeToNestedChain(currentValue, rest, callback, (sub) =>
                    {
                        nestedSubs.push(sub);
                        addSub(sub);
                    });
                }
            }
        }
        else if (!(first in scope.locals) && !(first in scope.host))
        {
            console.warn(`Binding dependency "${first}" not found on component ${scope.host.constructor.name}`);
        }
    }

    private __subscribeToNestedChain(obj: unknown, chain: string[], callback: () => void, addSub: (sub: Subscription) => void): void
    {
        if (chain.length === 0 || obj === null || obj === undefined) return;

        const [first, ...rest] = chain;

        const prop: unknown = Reflect.get(obj as object, first);

        if (prop instanceof Property)
        {
            if (rest.length === 0)
            {
                addSub(prop.onChange.subscribe(callback));
            }
            else
            {
                let nestedSubs: Subscription[] = [];

                const resubscribeNested = (): void =>
                {
                    for (const sub of nestedSubs)
                    {
                        sub.unsubscribe();
                    }
                    nestedSubs = [];

                    const currentValue: unknown = prop.getValue();
                    if (currentValue !== null && currentValue !== undefined)
                    {
                        this.__subscribeToNestedChain(currentValue, rest, callback, (sub) =>
                        {
                            nestedSubs.push(sub);
                            addSub(sub);
                        });
                    }

                    callback();
                };

                addSub(prop.onChange.subscribe(resubscribeNested));

                const currentValue: unknown = prop.getValue();
                if (currentValue !== null && currentValue !== undefined)
                {
                    this.__subscribeToNestedChain(currentValue, rest, callback, (sub) =>
                    {
                        nestedSubs.push(sub);
                        addSub(sub);
                    });
                }
            }
        }
        else if (rest.length > 0 && prop !== null && prop !== undefined)
        {
            this.__subscribeToNestedChain(prop, rest, callback, addSub);
        }
    }

    protected __getReactivePropFromScope(propName: string, scope: Scope): Property<unknown> | undefined
    {
        if (propName in scope.locals)
        {
            return undefined;
        }
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

    protected __setChildProperty(el: Element, propName: string, value: unknown): void
    {
        const prop: unknown = Reflect.get(el, propName);

        if (prop instanceof Property)
        {
            prop.setValue(value, true);
        }
        else if (DomUtils.isCustomElement(el))
        {
            this.__whenDefined(el.tagName.toLowerCase(), () =>
            {
                if (el instanceof FluffBase)
                {
                    Reflect.set(el, propName, value);
                }
            });
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

    private __applyPropertyBindingWithScope(el: HTMLElement, binding: BindingInfo, scope: Scope, subscriptions?: Subscription[]): void
    {
        const tagName = el.tagName.toLowerCase();
        const isCustomElement = customElements.get(tagName) !== undefined;
        const update = (): void =>
        {
            try
            {
                if (typeof binding.e !== 'number')
                {
                    throw new Error(`Binding for ${binding.n} is missing exprId`);
                }
                const fn = this.__getCompiledExprFn(binding.e);
                let value: unknown = fn(this, scope.locals);

                if (binding.p && binding.p.length > 0)
                {
                    value = this.__applyPipes(value, binding.p, scope.locals);
                }

                this.__setChildProperty(el, binding.n, value);
            }
            catch(e)
            {
                console.error('Property binding error:', e);
            }
        };

        this.__subscribeToExpressionInScope(binding.d, scope, update, subscriptions);

        if (binding.s)
        {
            this.__subscribeToExpressionInScope([binding.s], scope, update, subscriptions);
        }

        if (isCustomElement)
        {
            if (el instanceof FluffBase)
            {
                update();
            }
            else
            {
                this.__whenDefined(tagName, () =>
                {
                    if (el instanceof FluffBase)
                    {
                        update();
                    }
                    else
                    {
                        console.warn(`Element <${tagName}> is not a FluffBase instance after whenDefined - binding for "${binding.n}" skipped`);
                    }
                });
            }
        }
        else
        {
            update();
        }
    }

    private __applyEventBindingWithScope(el: HTMLElement, binding: BindingInfo, scope: Scope): void
    {
        if (typeof binding.h !== 'number')
        {
            throw new Error(`Event binding for ${binding.n} is missing handlerId`);
        }
        const handlerFn = this.__getCompiledHandlerFn(binding.h);

        if (el.hasAttribute('x-fluff-component'))
        {
            this.__applyOutputBinding(el, binding.n, handlerFn, scope);
        }
        else
        {
            el.addEventListener(binding.n, (event: Event) =>
            {
                try
                {
                    handlerFn(this, scope.locals, event);
                }
                catch(e)
                {
                    console.error('Event binding error:', e);
                }
            });
        }
    }

    private __applyOutputBinding(el: HTMLElement, outputName: string, handlerFn: HandlerFn, scope: Scope): void
    {
        const trySubscribe = (): boolean =>
        {
            const publisher: unknown = Reflect.get(el, outputName);
            if (publisher instanceof Publisher)
            {
                const sub = publisher.subscribe((value: unknown) =>
                {
                    try
                    {
                        handlerFn(this, scope.locals, value);
                    }
                    catch(e)
                    {
                        console.error('Output binding error:', e);
                    }
                });
                this.__baseSubscriptions.push(sub);
                return true;
            }
            return false;
        };

        if (trySubscribe())
        {
            return;
        }

        this.__whenDefined(el.tagName.toLowerCase(), () =>
        {
            trySubscribe();
        });
    }

    protected __whenDefined(tagName: string, callback: () => void): void
    {
        customElements.whenDefined(tagName)
            .then(callback)
            .catch(console.error);
    }


    private __applyTwoWayBindingWithScope(el: HTMLElement, binding: BindingInfo, scope: Scope, subscriptions?: Subscription[]): void
    {
        this.__applyPropertyBindingWithScope(el, binding, scope, subscriptions);

        if (typeof binding.t !== 'string' || binding.t.length === 0)
        {
            throw new Error(`Two-way binding for ${binding.n} is missing targetProp`);
        }
        const reactiveProp = this.__getReactivePropFromScope(binding.t, scope);

        const childPropCandidate = Reflect.get(el, binding.n);
        if (reactiveProp && childPropCandidate instanceof Property)
        {
            const sub = childPropCandidate.onChange.subscribe((val) =>
            {
                reactiveProp.setValue(val, true);
            });
            if (subscriptions)
            {
                subscriptions.push(sub);
            }
            else
            {
                this.__baseSubscriptions.push(sub);
            }
        }
    }

    private __applyClassBindingWithScope(el: HTMLElement, binding: BindingInfo, scope: Scope, subscriptions?: Subscription[]): void
    {
        const update = (): void =>
        {
            try
            {
                if (typeof binding.e !== 'number')
                {
                    throw new Error(`Class binding for ${binding.n} is missing exprId`);
                }
                const fn = this.__getCompiledExprFn(binding.e);
                const value = fn(this, scope.locals);
                if (value)
                {
                    el.classList.add(binding.n);
                }
                else
                {
                    el.classList.remove(binding.n);
                }
            }
            catch(e)
            {
                console.error('Class binding error:', e);
            }
        };

        this.__subscribeToExpressionInScope(binding.d, scope, update, subscriptions);
        update();
    }

    private __applyStyleBindingWithScope(el: HTMLElement, binding: BindingInfo, scope: Scope, subscriptions?: Subscription[]): void
    {
        const update = (): void =>
        {
            try
            {
                if (typeof binding.e !== 'number')
                {
                    throw new Error(`Style binding for ${binding.n} is missing exprId`);
                }
                const fn = this.__getCompiledExprFn(binding.e);
                const value = fn(this, scope.locals);
                el.style.setProperty(binding.n, String(value));
            }
            catch(e)
            {
                console.error('Style binding error:', e);
            }
        };

        this.__subscribeToExpressionInScope(binding.d, scope, update, subscriptions);
        update();
    }
}
