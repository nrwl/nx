export interface IfMarkerConfig
{
    type: 'if';
    branches: { exprId?: number; deps?: (string | string[])[] }[];
}
