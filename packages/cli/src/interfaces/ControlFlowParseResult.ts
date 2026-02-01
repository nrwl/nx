export interface ControlFlowParseResult
{
    tagName: string;
    attrs: { name: string; value: string }[];
    endPos: number;
    opensBlock: boolean;
}
