export interface TokenizeResult
{
    index: number;
    tokenCount: number;
    stopReason: 'end' | 'negative_depth' | 'delimiter';
}
