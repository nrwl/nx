import type { ProjectGraphExternalNode, ProjectGraphProjectNode } from '../../../../config/project-graph';
import type { PackageJson } from '../../../../utils/package-json';
/**
 * The key is a combination of the package name and the workspace relative directory
 * containing the file importing it e.g. `lodash__packages/my-lib`, the value is the
 * resolved external node name from the project graph.
 */
type NpmResolutionCache = Map<string, string | null>;
type PackageJsonResolutionCache = Map<string, PackageJson | null>;
type PathPattern = {
    pattern: string;
    prefix: string;
    suffix: string;
};
export declare function isBuiltinModuleImport(importExpr: string): boolean;
export declare class TargetProjectLocator {
    private readonly nodes;
    private readonly externalNodes;
    private readonly npmResolutionCache;
    private readonly packageJsonResolutionCache;
    private projectRootMappings;
    private npmProjects;
    private tsConfig;
    private paths;
    private parsedPathPatterns;
    private typescriptResolutionCache;
    private packagesMetadata;
    constructor(nodes: Record<string, ProjectGraphProjectNode>, externalNodes?: Record<string, ProjectGraphExternalNode>, npmResolutionCache?: NpmResolutionCache, packageJsonResolutionCache?: PackageJsonResolutionCache);
    /**
     * Resolve any workspace or external project that matches the given import expression,
     * originating from the given filePath.
     *
     * @param importExpr
     * @param filePath
     */
    findProjectFromImport(importExpr: string, filePath: string): string;
    /**
     * Resolve any external project that matches the given import expression,
     * relative to the given file path.
     *
     * @param importExpr
     * @param projectRoot
     */
    findNpmProjectFromImport(importExpr: string, fromFilePath: string): string | null;
    /**
     * Return file paths matching the import relative to the repo root
     * @param normalizedImportExpr
     * @deprecated Use `findMatchingPaths` instead. It will be removed in Nx v22.
     */
    findPaths(normalizedImportExpr: string): string[] | undefined;
    findMatchingPaths(importExpr: string): [pattern: string | PathPattern, paths: string[]] | undefined;
    findImportInWorkspaceProjects(importPath: string): string | null;
    findDependencyInWorkspaceProjects(packageJsonPath: string, dep: string, packageVersion: string): string | null;
    private isPatternMatch;
    private parsePaths;
    private resolveImportWithTypescript;
    private resolveImportWithRequire;
    private findProjectOfResolvedModule;
    private getAbsolutePath;
    private getRootTsConfig;
    private findMatchingProjectFiles;
    /**
     * In many cases the package.json will be directly resolvable, so we try that first.
     * If, however, package exports are used and the package.json is not defined, we will
     * need to resolve the main entry point of the package and traverse upwards to find the
     * package.json.
     *
     * In some cases, such as when multiple module formats are published, the resolved package.json
     * might only contain the "type" field - no "name" or "version", so in such cases we keep traversing
     * until we find a package.json that contains the "name" and "version" fields.
     */
    private readPackageJson;
}
export {};
