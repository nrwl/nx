import { Tree } from '../../../generators/tree';
export declare function printDiff(before: string, after: string, contextLines?: number, noDiffMessage?: string): void;
export declare function printAndFlushChanges(tree: Tree, isDryRun: boolean, diffContextLines?: number, shouldPrintDryRunMessage?: boolean, noDiffMessage?: string, changePredicate?: (f: {
    path: string;
    content?: Buffer;
}) => boolean): void;
