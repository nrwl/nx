type Location = {
    column: number;
    line: number;
};
type NodeLocation = {
    end?: Location;
    start?: Location;
};
export declare function codeFrameColumns(rawLines: string, loc: NodeLocation, opts?: {
    linesAbove?: number;
    linesBelow?: number;
    highlight?: (rawLines: string) => string;
}): string;
export {};
