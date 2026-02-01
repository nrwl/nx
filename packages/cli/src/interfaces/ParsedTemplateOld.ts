import type { ControlFlow } from './ControlFlow.js';
import type { TemplateBinding } from './TemplateBinding.js';

export interface ParsedTemplateOld
{
    html: string;
    bindings: TemplateBinding[];
    controlFlows: ControlFlow[];
    templateRefs: string[];
}
