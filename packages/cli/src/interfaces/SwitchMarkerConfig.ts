export interface SwitchMarkerConfig
{
    type: 'switch';
    expressionExprId: number;
    deps?: (string | string[])[];
    cases: { valueExprId?: number; isDefault: boolean; fallthrough: boolean }[];
}
