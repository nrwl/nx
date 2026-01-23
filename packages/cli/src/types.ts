export interface ComponentInfo
{
    className: string;
    selector: string;
    templatePath: string;
    stylePath?: string;
    filePath: string;
}

export interface TemplateBinding
{
    id: string;
    type: 'text' | 'property' | 'event' | 'class' | 'style';
    expression: string;
    target?: string;
    eventName?: string;
    className?: string;
    styleProp?: string;
}

export interface SwitchCase
{
    value: string | null;  // null for @default
    content: string;
    fallthrough: boolean;
}

export interface ControlFlow
{
    id: string;
    type: 'if' | 'for' | 'switch';
    condition?: string;
    ifContent?: string;
    elseContent?: string;
    iterator?: string;
    iterable?: string;
    trackBy?: string;
    content?: string;
    expression?: string;
    cases?: SwitchCase[];
}

export interface ParsedTemplate
{
    html: string;
    bindings: TemplateBinding[];
    controlFlows: ControlFlow[];
    templateRefs: string[];
}

export interface CompilerOptions
{
    srcDir: string;
    distDir: string;
    componentSelectors: Set<string>;
}
