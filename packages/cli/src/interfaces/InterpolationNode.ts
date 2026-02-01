import type { PropertyChain } from './PropertyChain.js';

export interface InterpolationNode
{
    type: 'interpolation';
    expression: string;
    deps?: PropertyChain[];
    id?: string;
    pipes?: { name: string; args: string[] }[];
}
