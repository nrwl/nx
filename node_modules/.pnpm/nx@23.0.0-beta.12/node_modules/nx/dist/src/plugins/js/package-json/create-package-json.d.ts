import { ProjectFileMap, ProjectGraph, ProjectGraphProjectNode } from '../../../config/project-graph';
import { PackageJson } from '../../../utils/package-json';
interface NpmDeps {
    readonly dependencies: Record<string, string>;
    readonly peerDependencies: Record<string, string>;
    readonly peerDependenciesMeta: Record<string, {
        optional: boolean;
    }>;
}
/**
 * Creates a package.json in the output directory for support to install dependencies within containers.
 *
 * If a package.json exists in the project, it will reuse that.
 * If isProduction flag is set, it wil  remove devDependencies and optional peerDependencies
 */
export declare function createPackageJson(projectName: string, graph: ProjectGraph, options?: {
    target?: string;
    root?: string;
    isProduction?: boolean;
    helperDependencies?: string[];
    skipPackageManager?: boolean;
    skipOverrides?: boolean;
}, fileMap?: ProjectFileMap): PackageJson;
export declare function findProjectsNpmDependencies(projectNode: ProjectGraphProjectNode, graph: ProjectGraph, target: string, rootPackageJson: PackageJson, options: {
    helperDependencies?: string[];
    ignoredDependencies?: string[];
    isProduction?: boolean;
}, fileMap?: ProjectFileMap): NpmDeps;
export {};
