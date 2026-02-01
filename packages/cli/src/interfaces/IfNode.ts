import type { IfBranch } from './IfBranch.js';

export interface IfNode
{
    type: 'if';
    branches: IfBranch[];
    localVariables: string[];
}
