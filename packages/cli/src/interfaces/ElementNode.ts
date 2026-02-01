import type { BindingInfo } from './BindingInfo.js';
import type { TemplateNode } from './TemplateNode.js';

export interface ElementNode
{
    type: 'element';
    tagName: string;
    attributes: Record<string, string>;
    bindings: BindingInfo[];
    children: TemplateNode[];
    id?: string;
}
