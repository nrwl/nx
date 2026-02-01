import type { Property } from '../utils/Property.js';

export interface FluffHostElement extends HTMLElement
{
    __getReactiveProp?: (name: string) => Property<unknown> | undefined;
    __pipes?: Record<string, (value: unknown, ...args: unknown[]) => unknown>;
}
