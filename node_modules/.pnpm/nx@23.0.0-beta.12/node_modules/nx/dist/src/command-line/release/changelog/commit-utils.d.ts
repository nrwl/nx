import { GitCommit } from '../utils/git';
import { FileData, ProjectFileMap } from '../../../config/project-graph';
import { NxReleaseConfig } from '../config/config';
import { ChangelogChange } from './version-plan-utils';
export declare function mapCommitToChange(commit: GitCommit, affectedProjects: string[] | '*'): ChangelogChange;
export declare function createChangesFromCommits(commits: GitCommit[], fileMap: {
    projectFileMap: ProjectFileMap;
    nonProjectFiles: FileData[];
}, fileToProjectMap: Record<string, string>, conventionalCommitsConfig: NxReleaseConfig['conventionalCommits']): ChangelogChange[];
export declare function filterHiddenChanges(changes: ChangelogChange[], conventionalCommitsConfig: NxReleaseConfig['conventionalCommits']): ChangelogChange[];
export declare function getProjectsAffectedByCommit(commit: GitCommit, fileToProjectMap: Record<string, string>): string[];
export declare function commitChangesNonProjectFiles(commit: GitCommit, nonProjectFiles: FileData[]): boolean;
export declare function createFileToProjectMap(projectFileMap: ProjectFileMap): Record<string, string>;
