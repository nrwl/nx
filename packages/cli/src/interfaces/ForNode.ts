import type { PropertyChain } from './PropertyChain.js';
import type { TemplateNode } from './TemplateNode.js';

export interface ForNode
{
    type: 'for';
    iterator: string;
    iterable: string;
    iterableDeps?: PropertyChain[];
    trackBy?: string;
    emptyContent?: TemplateNode[];
    children: TemplateNode[];
    localVariables: string[];
}
