import type { TemplateNode } from './TemplateNode.js';

export interface ParsedTemplate
{
    root: TemplateNode[];
    templateRefs: string[];
}
