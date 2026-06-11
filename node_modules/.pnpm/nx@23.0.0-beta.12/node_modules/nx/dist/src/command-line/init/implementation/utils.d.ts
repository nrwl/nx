import { NxJsonConfiguration } from '../../../config/nx-json';
import { PackageJson } from '../../../utils/package-json';
import { PackageManagerCommands } from '../../../utils/package-manager';
export declare function createNxJsonFile(repoRoot: string, topologicalTargets: string[], cacheableOperations: string[], scriptOutputs: {
    [name: string]: string;
}): void;
export declare function createNxJsonFromTurboJson(turboJson: Record<string, any>): NxJsonConfiguration;
export declare function addDepsToPackageJson(repoRoot: string, additionalPackages?: string[]): void;
export declare function updateGitIgnore(root: string): void;
export declare function runInstall(repoRoot: string, pmc?: PackageManagerCommands): void;
/**
 * Coerce any thrown value into a non-empty telemetry string. The naive
 * `error.message || String(error)` yields "" for bare `new Error()`.
 */
export declare function toErrorString(error: unknown): string;
export declare function readErrorStderr(error: unknown): string;
export declare function extractErrorName(error: unknown, stderr: string): string;
export declare function initCloud(installationSource: 'nx-init' | 'nx-init-angular' | 'nx-init-monorepo' | 'nx-init-nest' | 'nx-init-npm-repo' | 'nx-init-turborepo'): Promise<void>;
export declare function setNeverConnectToCloud(repoRoot: string): void;
export declare function addVsCodeRecommendedExtensions(repoRoot: string, extensions: string[]): void;
export declare function markRootPackageJsonAsNxProjectLegacy(repoRoot: string, cacheableScripts: string[], pmc: PackageManagerCommands): void;
export declare function markPackageJsonAsNxProject(packageJsonPath: string): void;
export declare function printFinalMessage({ learnMoreLink, appendLines, }: {
    learnMoreLink?: string;
    appendLines?: string[];
}): void;
export declare function isMonorepo(packageJson: PackageJson): boolean;
