import type { FluffHostElement } from '../interfaces/FluffHostElement.js';

export interface Scope
{
    host: FluffHostElement;
    locals: Record<string, unknown>;
    parent?: Scope;
}

const scopeRegistry = new Map<string, Scope>();
let scopeIdCounter = 0;

export function registerScope(scope: Scope): string
{
    const id = `scope_${scopeIdCounter++}`;
    scopeRegistry.set(id, scope);
    return id;
}

export function getScope(id: string): Scope | undefined
{
    return scopeRegistry.get(id);
}

export function unregisterScope(id: string): void
{
    scopeRegistry.delete(id);
}
