import type { MigrationDetailsWithId } from '../../config/misc-interfaces';
import type { FileChange } from '../../generators/tree';
export type MigrationsJsonMetadata = {
    completedMigrations?: Record<string, SuccessfulMigration | FailedMigration | SkippedMigration | StoppedMigration>;
    runningMigrations?: string[];
    initialGitRef?: {
        ref: string;
        subject: string;
    };
    confirmedPackageUpdates?: boolean;
    targetVersion?: string;
};
export type SuccessfulMigration = {
    type: 'successful';
    name: string;
    changedFiles: Omit<FileChange, 'content'>[];
    ref: string;
    nextSteps?: string[];
};
export type FailedMigration = {
    type: 'failed';
    name: string;
    error: string;
};
export type SkippedMigration = {
    type: 'skipped';
};
export type StoppedMigration = {
    type: 'stopped';
    name: string;
    error: string;
};
export declare function recordInitialMigrationMetadata(workspacePath: string, versionToMigrateTo: string): void;
export declare function finishMigrationProcess(workspacePath: string, squashCommits: boolean, commitMessage: string): void;
export declare function runSingleMigration(workspacePath: string, migration: MigrationDetailsWithId, configuration: {
    createCommits: boolean;
    commitPrefix?: string;
}): Promise<void>;
export declare function getImplementationPath(workspacePath: string, migration: MigrationDetailsWithId): Promise<string>;
export declare function modifyMigrationsJsonMetadata(workspacePath: string, modify: (migrationsJsonMetadata: MigrationsJsonMetadata) => MigrationsJsonMetadata): void;
export declare function addSuccessfulMigration(id: string, fileChanges: Omit<FileChange, 'content'>[], ref: string, nextSteps: string[]): (migrationsJsonMetadata: MigrationsJsonMetadata) => MigrationsJsonMetadata;
export declare function updateRefForSuccessfulMigration(id: string, ref: string): (migrationsJsonMetadata: MigrationsJsonMetadata) => MigrationsJsonMetadata;
export declare function addFailedMigration(id: string, error: string): (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    completedMigrations?: Record<string, SuccessfulMigration | FailedMigration | SkippedMigration | StoppedMigration>;
    runningMigrations?: string[];
    initialGitRef?: {
        ref: string;
        subject: string;
    };
    confirmedPackageUpdates?: boolean;
    targetVersion?: string;
};
export declare function addSkippedMigration(id: string): (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    completedMigrations?: Record<string, SuccessfulMigration | FailedMigration | SkippedMigration | StoppedMigration>;
    runningMigrations?: string[];
    initialGitRef?: {
        ref: string;
        subject: string;
    };
    confirmedPackageUpdates?: boolean;
    targetVersion?: string;
};
export declare function addStoppedMigration(id: string, error: string): (migrationsJsonMetadata: MigrationsJsonMetadata) => {
    completedMigrations?: Record<string, SuccessfulMigration | FailedMigration | SkippedMigration | StoppedMigration>;
    runningMigrations?: string[];
    initialGitRef?: {
        ref: string;
        subject: string;
    };
    confirmedPackageUpdates?: boolean;
    targetVersion?: string;
};
export declare function readMigrationsJsonMetadata(workspacePath: string): MigrationsJsonMetadata;
export declare function undoMigration(workspacePath: string, id: string): (migrationsJsonMetadata: MigrationsJsonMetadata) => MigrationsJsonMetadata;
export declare function killMigrationProcess(migrationId: string, workspacePath?: string): boolean;
export declare function stopMigration(migrationId: string): (migrationsJsonMetadata: MigrationsJsonMetadata) => MigrationsJsonMetadata;
