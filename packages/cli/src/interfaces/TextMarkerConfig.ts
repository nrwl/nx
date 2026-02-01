export interface TextMarkerConfig
{
    type: 'text';
    exprId: number;
    deps?: (string | string[])[];
    pipes?: { name: string; argExprIds: number[] }[];
}
