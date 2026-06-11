/**
 * Special thanks to changelogen for the original inspiration for many of these utilities:
 * https://github.com/unjs/changelogen
 */
import { ReleaseType } from 'semver';
import { NxReleaseConfig } from '../config/config';
import { GitCommit } from './git';
export declare const enum SemverSpecifier {
    MAJOR = 3,
    MINOR = 2,
    PATCH = 1
}
export declare const SemverSpecifierType: {
    3: string;
    2: string;
    1: string;
};
export declare function isRelativeVersionKeyword(val: string): val is ReleaseType;
export declare function isValidSemverSpecifier(specifier: string): boolean;
export declare function determineSemverChange(relevantCommits: Map<string, {
    commit: GitCommit;
    isProjectScopedCommit: boolean;
}[]>, config: NxReleaseConfig['conventionalCommits']): Map<string, SemverSpecifier | null>;
export declare function deriveNewSemverVersion(currentSemverVersion: string, semverSpecifier: string, preid?: string, options?: {
    adjustSemverBumpsForZeroMajorVersion?: boolean;
}): string;
