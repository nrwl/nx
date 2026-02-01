export interface ForMarkerConfig
{
    type: 'for';
    iterator: string;
    iterableExprId: number;
    deps?: (string | string[])[];
    trackBy?: string;
    hasEmpty: boolean;
}
