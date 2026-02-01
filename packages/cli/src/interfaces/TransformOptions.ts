export interface TransformOptions
{
    addThisPrefix?: boolean;
    nullSafe?: boolean;
    iteratorName?: string;
    iteratorReplacement?: string;
    localVars?: string[];
    localsObjectName?: string;
    eventReplacementName?: string;
    templateRefs?: string[];
}
