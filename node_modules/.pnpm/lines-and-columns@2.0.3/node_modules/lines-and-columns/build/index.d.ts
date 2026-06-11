export interface SourceLocation {
    line: number;
    column: number;
}
export declare class LinesAndColumns {
    private readonly length;
    private readonly offsets;
    constructor(string: string);
    locationForIndex(index: number): SourceLocation | null;
    indexForLocation(location: SourceLocation): number | null;
    private lengthOfLine;
}
