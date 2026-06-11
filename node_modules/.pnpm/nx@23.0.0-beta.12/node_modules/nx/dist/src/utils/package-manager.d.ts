export type PackageManager = 'yarn' | 'pnpm' | 'npm' | 'bun';
export interface PackageManagerCommands {
    preInstall?: string;
    install: string;
    ciInstall: string;
    updateLockFile: string;
    add: string;
    addDev: string;
    rm: string;
    exec: string;
    dlx: string;
    list: string;
    why: string;
    run: (script: string, args?: string) => string;
    getRegistryUrl?: string;
    publish: (packageRoot: string, registry: string, registryConfigKey: string, tag: string) => string;
    ignoreScriptsFlag?: string;
}
/**
 * Detects which package manager is used in the workspace based on the lock file.
 */
export declare function detectPackageManager(dir?: string): PackageManager;
/**
 * Returns true if the workspace is using npm workspaces, yarn workspaces, or pnpm workspaces.
 * @param packageManager The package manager to use. If not provided, it will be detected based on the lock file.
 * @param root The directory the commands will be ran inside of. Defaults to the current workspace's root.
 */
export declare function isWorkspacesEnabled(packageManager?: PackageManager, root?: string): boolean;
/**
 * Returns commands for the package manager used in the workspace.
 * By default, the package manager is derived based on the lock file,
 * but it can also be passed in explicitly.
 *
 * Example:
 *
 * ```javascript
 * execSync(`${getPackageManagerCommand().addDev} my-dev-package`);
 * ```
 *
 * @param packageManager The package manager to use. If not provided, it will be detected based on the lock file.
 * @param root The directory the commands will be ran inside of. Defaults to the current workspace's root.
 */
export declare function getPackageManagerCommand(packageManager?: PackageManager, root?: string): PackageManagerCommands;
/**
 * Returns the version of the package manager used in the workspace.
 * By default, the package manager is derived based on the lock file,
 * but it can also be passed in explicitly.
 */
export declare function getPackageManagerVersion(packageManager?: PackageManager, cwd?: string): string;
export declare function parseVersionFromPackageManagerField(requestedPackageManager: string, packageManagerFieldValue: string | undefined): null | string;
/**
 * Checks for a project level npmrc file by crawling up the file tree until
 * hitting a package.json file, as this is how npm finds them as well.
 */
export declare function findFileInPackageJsonDirectory(file: string, directory?: string): string | null;
/**
 * We copy yarnrc.yml to the temporary directory to ensure things like the specified
 * package registry are still used. However, there are a few relative paths that can
 * cause issues, so we modify them to fit the new directory.
 *
 * Exported for testing - not meant to be used outside of this file.
 *
 * @param contents The string contents of the yarnrc.yml file
 * @returns Updated string contents of the yarnrc.yml file
 */
export declare function modifyYarnRcYmlToFitNewDirectory(contents: string): string;
/**
 * We copy .yarnrc to the temporary directory to ensure things like the specified
 * package registry are still used. However, there are a few relative paths that can
 * cause issues, so we modify them to fit the new directory.
 *
 * Exported for testing - not meant to be used outside of this file.
 *
 * @param contents The string contents of the yarnrc.yml file
 * @returns Updated string contents of the yarnrc.yml file
 */
export declare function modifyYarnRcToFitNewDirectory(contents: string): string;
export declare function copyPackageManagerConfigurationFiles(root: string, destination: string): void;
/**
 * Creates a temporary directory where you can run package manager commands safely.
 *
 * For cases where you'd want to install packages that require an `.npmrc` set up,
 * this function looks up for the nearest `.npmrc` (if exists) and copies it over to the
 * temp directory.
 *
 * @param skipCopy - If true, skips copying package manager configuration files to the temporary directory.
 *                   This is useful when creating a workspace from scratch (e.g., in create-nx-workspace)
 *                   where no existing configuration files are available to copy.
 */
export declare function createTempNpmDirectory(skipCopy?: boolean): {
    dir: string;
    cleanup: () => Promise<void>;
};
/**
 * Returns the resolved version for a given package and version tag using the
 * NPM registry (when using Yarn it will fall back to NPM to fetch the info).
 */
export declare function resolvePackageVersionUsingRegistry(packageName: string, version: string): Promise<string>;
/**
 * Return the resolved version for a given package and version tag using by
 * installing it in a temporary directory and fetching the version from the
 * package.json.
 */
export declare function resolvePackageVersionUsingInstallation(packageName: string, version: string): Promise<string>;
export declare function packageRegistryView(pkg: string, version: string, args: string): Promise<string>;
export declare function packageRegistryPack(cwd: string, pkg: string, version: string): Promise<{
    tarballPath: string;
}>;
/**
 * Gets the workspaces defined in the package manager configuration.
 * @returns workspaces defined in the package manager configuration, empty array if none are defined
 */
export declare function getPackageWorkspaces(packageManager?: PackageManager, root?: string): string[];
/**
 * Adds a package to the workspaces defined in the package manager configuration.
 * If the package is already included in the workspaces, it will not be added again.
 * @param packageManager The package manager to use. If not provided, it will be detected based on the lock file.
 * @param workspaces The workspaces to add the package to. Defaults to the workspaces defined in the package manager configuration.
 * @param root The directory the commands will be ran inside of. Defaults to the current workspace's root.
 * @param packagePath The path of the package to add to the workspaces
 */
export declare function addPackagePathToWorkspaces(packagePath: string, packageManager?: PackageManager, workspaces?: string[], root?: string): void;
