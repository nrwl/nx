import type { PropertyChain } from './PropertyChain.js';
import type { TemplateNode } from './TemplateNode.js';

export interface IfBranch
{
    condition?: string;
    conditionDeps?: PropertyChain[];
    children: TemplateNode[];
}
