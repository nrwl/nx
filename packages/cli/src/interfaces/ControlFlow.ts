export interface SwitchCaseOld
{
    value: string | null;
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
    cases?: SwitchCaseOld[];
}
