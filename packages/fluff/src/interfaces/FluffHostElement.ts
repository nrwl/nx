import type { Property } from '../utils/Property.js';
import type { PropertyChain } from './PropertyChain.js';
import type { Subscription } from './Subscription.js';

export interface FluffHostScope
{
    host: FluffHostElement;
    locals: Record<string, unknown>;
    parent?: FluffHostScope;
}

export interface FluffHostElement extends HTMLElement
{
    __getReactiveProp?: (name: string) => Property<unknown> | undefined;
    __pipes?: Record<string, (value: unknown, ...args: unknown[]) => unknown>;
    __subscribeToExpression?: (deps: PropertyChain[], scope: FluffHostScope, callback: () => void, subscriptions: Subscription[]) => void;
    __evaluateExpr?: (exprId: number, locals: Record<string, unknown>) => unknown;
    __applyPipesForController?: (value: unknown, pipes: { name: string; argExprIds: number[] }[], locals: Record<string, unknown>) => unknown;
}
