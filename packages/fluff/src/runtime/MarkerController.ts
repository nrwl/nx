import type { FluffHostElement } from '../interfaces/FluffHostElement.js';
import type { PropertyChain } from '../interfaces/PropertyChain.js';
import type { RenderContext } from '../interfaces/RenderContext.js';
import type { Subscription } from '../interfaces/Subscription.js';
import { DomUtils } from '../utils/DomUtils.js';
import { Property } from '../utils/Property.js';
import { FluffBase } from './FluffBase.js';
import { FluffElement } from './FluffElement.js';
import { MarkerConfigGuards } from './MarkerConfigGuards.js';
import { registerScope, type Scope } from './ScopeRegistry.js';

interface MarkerManagerLike
{
    getController: (id: number, startMarker: Comment) => MarkerController | undefined;
    ensureController?: (id: number, type: string, startMarker: Comment, endMarker: Comment | null) => MarkerController | undefined;
    cleanupController?: (id: number, startMarker?: Comment) => void;
}

export abstract class MarkerController
{
    protected readonly subscriptions: Subscription[] = [];
    protected readonly host: FluffHostElement;
    protected readonly shadowRoot: ShadowRoot;
    protected parentScope: Scope | undefined;
    protected loopContext: Record<string, unknown> = {};
    protected markerManager: MarkerManagerLike | undefined;

    protected constructor(protected readonly id: number, protected readonly startMarker: Comment, protected readonly endMarker: Comment | null, host: FluffHostElement, shadowRoot: ShadowRoot)
    {
        this.host = host;
        this.shadowRoot = shadowRoot;
    }

    public setParentScope(scope: Scope | undefined): void
    {
        this.parentScope = scope;
    }

    public setLoopContext(context: Record<string, unknown>): void
    {
        this.loopContext = context;
    }

    public setMarkerManager(markerManager: MarkerManagerLike): void
    {
        this.markerManager = markerManager;
    }

    public abstract initialize(): void;

    public cleanup(): void
    {
        for (const sub of this.subscriptions)
        {
            sub.unsubscribe();
        }
        this.subscriptions.length = 0;
    }

    public updateRenderContext(renderContext?: RenderContext): void
    {
        if (renderContext)
        {
            return;
        }
    }

    protected evaluateExpr(exprId: number): unknown
    {
        const scope = this.getScope();
        const allLocals = this.collectLocalsFromScope(scope);
        const fn = this.getCompiledExprFn(exprId);
        try
        {
            return fn(scope.host, allLocals);
        }
        catch(e: unknown)
        {
            return undefined;
        }
    }

    private getCompiledExprFn(exprId: number): (t: FluffHostElement, l: Record<string, unknown>) => unknown
    {
        const fn = FluffBase.__e[exprId];
        if (typeof fn !== 'function')
        {
            throw new Error(`Missing compiled expression function for exprId ${exprId}`);
        }
        return fn;
    }

    protected getScope(): Scope
    {
        if (this.parentScope)
        {
            return this.parentScope;
        }
        const fluffHost = this.__getFluffElementHost();
        if (fluffHost)
        {
            return fluffHost.__getScope();
        }
        return {
            host: this.host, locals: this.loopContext, parent: undefined
        };
    }

    protected collectLocalsFromScope(scope: Scope): Record<string, unknown>
    {
        const result: Record<string, unknown> = {};
        if (scope.parent)
        {
            Object.assign(result, this.collectLocalsFromScope(scope.parent));
        }
        Object.assign(result, scope.locals);
        return result;
    }

    protected subscribeTo(deps: PropertyChain[], callback: () => void): void
    {
        const scope = this.getScope();
        for (const dep of deps)
        {
            if (Array.isArray(dep))
            {
                this.subscribeToPropertyChain(dep, scope, callback);
            }
            else
            {
                if (dep.startsWith('[')) continue;
                const reactiveProp = this.getReactivePropFromScope(dep, scope);
                if (reactiveProp)
                {
                    const sub = reactiveProp.onChange.subscribe(callback);
                    this.subscriptions.push(sub);
                }
            }
        }
    }

    private subscribeToPropertyChain(chain: string[], scope: Scope, callback: () => void): void
    {
        if (chain.length === 0) return;

        const [first, ...rest] = chain;
        if (first.startsWith('[')) return;

        const reactiveProp = this.getReactivePropFromScope(first, scope);
        if (reactiveProp)
        {
            if (rest.length === 0)
            {
                this.subscriptions.push(reactiveProp.onChange.subscribe(callback));
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
                        this.subscribeToNestedChain(currentValue, rest, callback, (sub) =>
                        {
                            nestedSubs.push(sub);
                            this.subscriptions.push(sub);
                        });
                    }

                    callback();
                };

                this.subscriptions.push(reactiveProp.onChange.subscribe(resubscribeNested));

                const currentValue: unknown = reactiveProp.getValue();
                if (currentValue !== null && currentValue !== undefined)
                {
                    this.subscribeToNestedChain(currentValue, rest, callback, (sub) =>
                    {
                        nestedSubs.push(sub);
                        this.subscriptions.push(sub);
                    });
                }
            }
        }
    }

    private subscribeToNestedChain(obj: unknown, chain: string[], callback: () => void, addSub: (sub: Subscription) => void): void
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
                        this.subscribeToNestedChain(currentValue, rest, callback, (sub) =>
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
                    this.subscribeToNestedChain(currentValue, rest, callback, (sub) =>
                    {
                        nestedSubs.push(sub);
                        addSub(sub);
                    });
                }
            }
        }
        else if (rest.length > 0 && prop !== null && prop !== undefined)
        {
            this.subscribeToNestedChain(prop, rest, callback, addSub);
        }
    }

    protected getReactivePropFromScope(propName: string, scope: Scope): Property<unknown> | undefined
    {
        if (propName in scope.locals)
        {
            return undefined;
        }
        if (scope.parent)
        {
            return this.getReactivePropFromScope(propName, scope.parent);
        }
        if (MarkerConfigGuards.isFluffHostElement(scope.host) && scope.host.__getReactiveProp)
        {
            const reactiveProp = scope.host.__getReactiveProp(propName);
            if (reactiveProp instanceof Property)
            {
                return reactiveProp;
            }
        }
        return undefined;
    }

    protected createChildScope(locals: Record<string, unknown>): Scope
    {
        return {
            host: this.host, locals, parent: this.parentScope
        };
    }

    protected clearContentBetweenMarkersWithCleanup(bindingsSubscriptions: Subscription[]): void
    {
        for (const sub of bindingsSubscriptions)
        {
            sub.unsubscribe();
        }
        bindingsSubscriptions.length = 0;

        if (!this.endMarker) return;

        const parent = this.startMarker.parentNode;
        if (!parent) return;

        let current = this.startMarker.nextSibling;
        while (current && current !== this.endMarker)
        {
            const next = current.nextSibling;

            if (current instanceof Comment)
            {
                const markerMatch = /^fluff:(if|for|switch|text|break):(\d+)$/.exec(current.data);
                if (markerMatch && this.markerManager?.cleanupController)
                {
                    const markerId = parseInt(markerMatch[2], 10);
                    this.markerManager.cleanupController(markerId, current);
                }
            }

            if (!(current instanceof HTMLTemplateElement))
            {
                parent.removeChild(current);
            }
            current = next;
        }
    }

    protected insertBeforeEndMarker(node: Node): void
    {
        if (!this.endMarker) return;
        const parent = this.endMarker.parentNode;
        if (!parent) return;
        parent.insertBefore(node, this.endMarker);
    }

    protected refreshParentBindings(): void
    {
        const parent = this.startMarker.parentNode;
        if (!(parent instanceof HTMLElement)) return;
        if (!parent.hasAttribute('data-lid')) return;

        const fluffHost = this.__getFluffElementHost();
        if (!fluffHost) return;

        const scope = this.getScope();
        fluffHost.__processBindingsOnElementPublic(parent, scope);
    }

    protected processBindingsOnElement(el: HTMLElement, scope: Scope): void
    {
        const fluffHost = this.__getFluffElementHost();
        if (!fluffHost) return;
        fluffHost.__processBindingsOnElementPublic(el, scope);
    }

    protected processBindingsOnElementWithSubscriptions(el: HTMLElement, scope: Scope, subscriptions: Subscription[]): void
    {
        const fluffHost = this.__getFluffElementHost();
        if (!fluffHost) return;
        fluffHost.__processBindingsOnElementPublic(el, scope, subscriptions);
    }

    private __getFluffElementHost(): FluffElement | null
    {
        return this.host instanceof FluffElement ? this.host : null;
    }

    protected setScopeOnChildren(node: Node, scope: Scope, renderContext?: RenderContext, markerManager?: MarkerManagerLike, bindingsSubscriptions?: Subscription[]): void
    {
        if (node instanceof Comment)
        {
            const markerMatch = /^fluff:(if|for|switch|text|break):(\d+)$/.exec(node.data);
            if (markerMatch && markerManager)
            {
                const [, markerType, markerIdStr] = markerMatch;
                const markerId = parseInt(markerIdStr, 10);
                const endPattern = `/fluff:${markerType}:${markerId}`;

                let controller = markerManager.getController(markerId, node);
                const shouldInitialize = controller === undefined;
                if (!controller && markerManager.ensureController)
                {
                    let endMarker: Comment | null = null;
                    let current: Node | null = node.nextSibling;
                    while (current)
                    {
                        if (current instanceof Comment && current.data === endPattern)
                        {
                            endMarker = current;
                            break;
                        }
                        current = current.nextSibling;
                    }

                    controller = markerManager.ensureController(markerId, markerType, node, endMarker);
                }
                if (controller)
                {
                    controller.setParentScope(scope);
                    controller.setLoopContext(scope.locals);
                    controller.updateRenderContext(renderContext);

                    if (shouldInitialize)
                    {
                        controller.initialize();
                    }
                }
            }
        }
        else if (node instanceof FluffElement)
        {
            node.__loopContext = scope.locals;
            node.__parentScope = scope;
            this.processBindingsOnNode(node, scope, bindingsSubscriptions);
        }
        else if (node instanceof HTMLElement && DomUtils.isCustomElement(node))
        {
            const scopeId = registerScope(scope);
            node.setAttribute('data-fluff-scope-id', scopeId);
            this.processBindingsOnNode(node, scope, bindingsSubscriptions);
        }
        else if (node instanceof HTMLElement && node.hasAttribute('data-lid'))
        {
            this.processBindingsOnNode(node, scope, bindingsSubscriptions);
        }

        for (const child of Array.from(node.childNodes))
        {
            this.setScopeOnChildren(child, scope, renderContext, markerManager, bindingsSubscriptions);
        }
    }

    protected insertAndScopeTemplateContent(content: Node, nodes: Node[], scope: Scope, renderContext: RenderContext | undefined, markerManager: MarkerManagerLike | undefined, bindingsSubscriptions: Subscription[]): void
    {
        this.insertBeforeEndMarker(content);
        for (const node of nodes)
        {
            this.setScopeOnChildren(node, scope, renderContext, markerManager, bindingsSubscriptions);
        }
    }

    protected cloneAndInsertTemplate(template: HTMLTemplateElement, context: Record<string, unknown>, renderContext: RenderContext | undefined, bindingsSubscriptions: Subscription[]): void
    {
        const content = template.content.cloneNode(true);
        if (!(content instanceof DocumentFragment))
        {
            throw new Error('Expected DocumentFragment from template clone');
        }
        const nodes = Array.from(content.childNodes);
        const scope = this.createChildScope(context);
        this.insertAndScopeTemplateContent(content, nodes, scope, renderContext, this.markerManager, bindingsSubscriptions);
    }

    protected processBindingsOnNode(node: HTMLElement, scope: Scope, bindingsSubscriptions?: Subscription[]): void
    {
        if (bindingsSubscriptions)
        {
            this.processBindingsOnElementWithSubscriptions(node, scope, bindingsSubscriptions);
        }
        else
        {
            this.processBindingsOnElement(node, scope);
        }
    }
}
