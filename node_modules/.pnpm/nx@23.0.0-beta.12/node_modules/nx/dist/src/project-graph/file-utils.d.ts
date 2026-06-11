import type { FileData } from '../config/project-graph';
import type { NxArgs } from '../utils/command-line-utils';
export interface Change {
    type: string;
}
export interface FileChange<T extends Change = Change> {
    file: string;
    getChanges: () => T[];
}
export declare class WholeFileChange implements Change {
    type: string;
}
export declare class DeletedFileChange implements Change {
    type: string;
}
export declare function isWholeFileChange(change: Change): change is WholeFileChange;
export declare function isDeletedFileChange(change: Change): change is DeletedFileChange;
export declare function calculateFileChanges(files: string[], nxArgs?: NxArgs, readFileAtRevision?: {
    (f: string, r: string | void): string;
}, ignore?: ReturnType<typeof ignore>): FileChange[];
export declare const TEN_MEGABYTES: number;
export declare function defaultFileRead(filePath: string): string | null;
export declare function readPackageJson(root?: string): any;
export { FileData };
