import type { TemplateNode } from './TemplateNode.js';

export interface SwitchCase
{
    valueExpression?: string;
    isDefault: boolean;
    fallthrough: boolean;
    children: TemplateNode[];
}
