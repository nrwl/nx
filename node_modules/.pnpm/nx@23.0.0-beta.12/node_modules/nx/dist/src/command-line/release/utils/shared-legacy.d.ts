import { Tree } from '../../../generators/tree';
export type ReleaseVersionGeneratorResult = {
    data: VersionData;
    callback: (tree: Tree, opts: {
        dryRun?: boolean;
        verbose?: boolean;
        generatorOptions?: Record<string, unknown>;
    }) => Promise<string[] | {
        changedFiles: string[];
        deletedFiles: string[];
    }>;
};
export type VersionData = Record<string, {
    /**
     * newVersion will be null in the case that no changes are detected for the project,
     * e.g. when using conventional commits
     */
    newVersion: string | null;
    currentVersion: string;
    /**
     * The list of projects which depend upon the current project.
     * NOTE: This is more strictly typed in versioning v2.
     */
    dependentProjects: any[];
}>;
