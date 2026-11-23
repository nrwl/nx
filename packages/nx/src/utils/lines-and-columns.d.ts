// lines-and-columns@2 ships types, but its `exports` map has no `types` condition.
declare module 'lines-and-columns' {
  export interface SourceLocation {
    line: number;
    column: number;
  }

  export class LinesAndColumns {
    constructor(string: string);
    locationForIndex(index: number): SourceLocation | null;
    indexForLocation(location: SourceLocation): number | null;
  }
}
