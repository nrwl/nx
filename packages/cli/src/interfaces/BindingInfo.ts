import type { PropertyChain } from './PropertyChain.js';

export interface BindingInfo
{
    name: string;
    binding: 'property' | 'event' | 'two-way' | 'class' | 'style' | 'ref';
    expression?: string;
    exprId?: number;
    handlerId?: number;
    targetProp?: string;
    deps?: PropertyChain[];
    subscribe?: string;
    pipes?: { name: string; args: string[] }[];
}
