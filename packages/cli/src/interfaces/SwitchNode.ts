import type { PropertyChain } from './PropertyChain.js';
import type { SwitchCase } from './SwitchCase.js';

export interface SwitchNode
{
    type: 'switch';
    expression: string;
    expressionDeps?: PropertyChain[];
    cases: SwitchCase[];
    localVariables: string[];
}
