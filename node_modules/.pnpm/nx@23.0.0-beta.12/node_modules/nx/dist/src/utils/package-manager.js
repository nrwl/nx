"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectPackageManager = detectPackageManager;
exports.isWorkspacesEnabled = isWorkspacesEnabled;
exports.getPackageManagerCommand = getPackageManagerCommand;
exports.getPackageManagerVersion = getPackageManagerVersion;
exports.parseVersionFromPackageManagerField = parseVersionFromPackageManagerField;
exports.findFileInPackageJsonDirectory = findFileInPackageJsonDirectory;
exports.modifyYarnRcYmlToFitNewDirectory = modifyYarnRcYmlToFitNewDirectory;
exports.modifyYarnRcToFitNewDirectory = modifyYarnRcToFitNewDirectory;
exports.copyPackageManagerConfigurationFiles = copyPackageManagerConfigurationFiles;
exports.createTempNpmDirectory = createTempNpmDirectory;
exports.resolvePackageVersionUsingRegistry = resolvePackageVersionUsingRegistry;
exports.resolvePackageVersionUsingInstallation = resolvePackageVersionUsingInstallation;
exports.packageRegistryView = packageRegistryView;
exports.packageRegistryPack = packageRegistryPack;
exports.getPackageWorkspaces = getPackageWorkspaces;
exports.addPackagePathToWorkspaces = addPackagePathToWorkspaces;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const promises_1 = require("node:fs/promises");
const path_1 = require("path");
const semver_1 = require("semver");
const tmp_1 = require("tmp");
const util_1 = require("util");
const yaml_1 = require("yaml");
const configuration_1 = require("../config/configuration");
const file_utils_1 = require("../project-graph/file-utils");
const catalog_1 = require("./catalog");
const fileutils_1 = require("./fileutils");
const installation_directory_1 = require("./installation-directory");
const package_json_1 = require("./package-json");
const workspace_root_1 = require("./workspace-root");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Detects which package manager is used in the workspace based on the lock file.
 */
function detectPackageManager(dir = '') {
    const nxJson = (0, configuration_1.readNxJson)();
    return (nxJson.cli?.packageManager ??
        ((0, fs_1.existsSync)((0, path_1.join)(dir, 'bun.lockb')) || (0, fs_1.existsSync)((0, path_1.join)(dir, 'bun.lock'))
            ? 'bun'
            : (0, fs_1.existsSync)((0, path_1.join)(dir, 'yarn.lock'))
                ? 'yarn'
                : (0, fs_1.existsSync)((0, path_1.join)(dir, 'pnpm-lock.yaml'))
                    ? 'pnpm'
                    : (0, fs_1.existsSync)((0, path_1.join)(dir, 'package-lock.json'))
                        ? 'npm'
                        : detectInvokedPackageManager()));
}
/**
 * Detects which package manager was used to invoke the current command
 * based on the npm_config_user_agent environment variable.
 *
 * Falls back to 'npm' if detection fails.
 */
function detectInvokedPackageManager() {
    const userAgent = process.env.npm_config_user_agent;
    if (userAgent) {
        if (userAgent.startsWith('pnpm/')) {
            return 'pnpm';
        }
        if (userAgent.startsWith('yarn/')) {
            return 'yarn';
        }
        if (userAgent.startsWith('bun/')) {
            return 'bun';
        }
    }
    return 'npm';
}
/**
 * Returns true if the workspace is using npm workspaces, yarn workspaces, or pnpm workspaces.
 * @param packageManager The package manager to use. If not provided, it will be detected based on the lock file.
 * @param root The directory the commands will be ran inside of. Defaults to the current workspace's root.
 */
function isWorkspacesEnabled(packageManager = detectPackageManager(), root = workspace_root_1.workspaceRoot) {
    if (packageManager === 'pnpm') {
        if (!(0, fs_1.existsSync)((0, path_1.join)(root, 'pnpm-workspace.yaml'))) {
            return false;
        }
        try {
            const content = (0, fs_1.readFileSync)((0, path_1.join)(root, 'pnpm-workspace.yaml'), 'utf-8');
            const { load } = require('@zkochan/js-yaml');
            const { packages } = load(content) ?? {};
            return packages !== undefined;
        }
        catch {
            return false;
        }
    }
    // yarn and npm both use the same 'workspaces' property in package.json
    const packageJson = (0, file_utils_1.readPackageJson)(root);
    return !!packageJson?.workspaces;
}
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
function getPackageManagerCommand(packageManager = detectPackageManager(), root = workspace_root_1.workspaceRoot) {
    const commands = {
        yarn: () => {
            let yarnVersion, useBerry;
            try {
                yarnVersion = getPackageManagerVersion('yarn', root);
                useBerry = (0, semver_1.gte)(yarnVersion, '2.0.0');
            }
            catch {
                yarnVersion = 'latest';
                useBerry = true;
            }
            // new versions of yarn only support ignoring scripts via .yarnrc.yml
            return {
                preInstall: `yarn set version ${yarnVersion}`,
                install: 'yarn',
                ciInstall: useBerry
                    ? 'yarn install --immutable'
                    : 'yarn install --frozen-lockfile',
                updateLockFile: useBerry
                    ? 'yarn install --mode update-lockfile'
                    : 'yarn install',
                add: useBerry ? 'yarn add' : 'yarn add -W',
                addDev: useBerry ? 'yarn add -D' : 'yarn add -D -W',
                rm: 'yarn remove',
                exec: 'yarn',
                dlx: useBerry ? 'yarn dlx' : 'npx',
                run: (script, args) => `yarn ${script}${args ? ` ${args}` : ''}`,
                list: useBerry ? 'yarn info --name-only' : 'yarn list',
                why: 'yarn why',
                getRegistryUrl: useBerry
                    ? 'yarn config get npmRegistryServer'
                    : 'yarn config get registry',
                publish: (packageRoot, registry, registryConfigKey, tag) => `npm publish "${packageRoot}" --json --"${registryConfigKey}=${registry}" --tag=${tag}`,
                ignoreScriptsFlag: useBerry ? undefined : `--ignore-scripts`,
            };
        },
        pnpm: () => {
            let modernPnpm, includeDoubleDashBeforeArgs, allowRegistryConfigKey;
            try {
                const pnpmVersion = getPackageManagerVersion('pnpm', root);
                modernPnpm = (0, semver_1.gte)(pnpmVersion, '6.13.0');
                includeDoubleDashBeforeArgs = (0, semver_1.lt)(pnpmVersion, '7.0.0');
                // Support for --@scope:registry was added in pnpm v10.5.0 and backported to v9.15.7.
                // Versions >=10.0.0 and <10.5.0 do NOT support this CLI option.
                allowRegistryConfigKey = (0, semver_1.satisfies)(pnpmVersion, '>=9.15.7 <10.0.0 || >=10.5.0');
            }
            catch {
                modernPnpm = true;
                includeDoubleDashBeforeArgs = true;
                allowRegistryConfigKey = false;
            }
            const isPnpmWorkspace = (0, fs_1.existsSync)((0, path_1.join)(root, 'pnpm-workspace.yaml'));
            return {
                install: 'pnpm install --no-frozen-lockfile', // explicitly disable in case of CI
                ciInstall: 'pnpm install --frozen-lockfile',
                updateLockFile: 'pnpm install --lockfile-only',
                add: isPnpmWorkspace ? 'pnpm add -w' : 'pnpm add',
                addDev: isPnpmWorkspace ? 'pnpm add -Dw' : 'pnpm add -D',
                rm: 'pnpm rm',
                exec: modernPnpm ? 'pnpm exec' : 'pnpx',
                dlx: modernPnpm ? 'pnpm dlx' : 'pnpx',
                run: (script, args) => `pnpm run ${script}${args
                    ? includeDoubleDashBeforeArgs
                        ? ' -- ' + args
                        : ` ${args}`
                    : ''}`,
                list: 'pnpm ls --depth 100',
                why: 'pnpm why',
                getRegistryUrl: 'pnpm config get registry',
                publish: (packageRoot, registry, registryConfigKey, tag) => `pnpm publish "${packageRoot}" --json --"${allowRegistryConfigKey ? registryConfigKey : 'registry'}=${registry}" --tag=${tag} --no-git-checks`,
                ignoreScriptsFlag: '--ignore-scripts',
            };
        },
        npm: () => {
            return {
                install: 'npm install',
                ciInstall: 'npm ci',
                updateLockFile: 'npm install --package-lock-only',
                add: 'npm install',
                addDev: 'npm install -D',
                rm: 'npm rm',
                exec: 'npx',
                dlx: 'npx',
                run: (script, args) => `npm run ${script}${args ? ' -- ' + args : ''}`,
                list: 'npm ls',
                why: 'npm explain',
                getRegistryUrl: 'npm config get registry',
                publish: (packageRoot, registry, registryConfigKey, tag) => `npm publish "${packageRoot}" --json --"${registryConfigKey}=${registry}" --tag=${tag}`,
                ignoreScriptsFlag: '--ignore-scripts',
            };
        },
        bun: () => {
            // bun doesn't current support programmatically reading config https://github.com/oven-sh/bun/issues/7140
            return {
                install: 'bun install',
                ciInstall: 'bun install --no-cache',
                updateLockFile: 'bun install --lockfile-only',
                add: 'bun install',
                addDev: 'bun install -D',
                rm: 'bun rm',
                exec: 'bun',
                dlx: 'bunx',
                run: (script, args) => `bun run ${script} -- ${args}`,
                list: 'bun pm ls',
                why: 'bun why',
                // Unlike npm, bun publish does not support a custom registryConfigKey option
                publish: (packageRoot, registry, registryConfigKey, tag) => `bun publish --cwd="${packageRoot}" --json --registry="${registry}" --tag=${tag}`,
                ignoreScriptsFlag: '--ignore-scripts',
            };
        },
    };
    return commands[packageManager]();
}
/**
 * Returns the version of the package manager used in the workspace.
 * By default, the package manager is derived based on the lock file,
 * but it can also be passed in explicitly.
 */
function getPackageManagerVersion(packageManager = detectPackageManager(), cwd = process.cwd()) {
    let version;
    if ((0, fs_1.existsSync)((0, path_1.join)(cwd, 'package.json'))) {
        const packageManagerEntry = (0, fileutils_1.readJsonFile)((0, path_1.join)(cwd, 'package.json'))?.packageManager;
        version = parseVersionFromPackageManagerField(packageManager, packageManagerEntry);
    }
    if (!version) {
        try {
            version = (0, child_process_1.execSync)(`${packageManager} --version`, {
                cwd,
                encoding: 'utf-8',
                windowsHide: true,
            }).trim();
        }
        catch { }
    }
    if (!version) {
        throw new Error(`Cannot determine the version of ${packageManager}.`);
    }
    return version;
}
function parseVersionFromPackageManagerField(requestedPackageManager, packageManagerFieldValue) {
    if (!packageManagerFieldValue)
        return null;
    const [packageManagerFromPackageJson, versionFromPackageJson] = packageManagerFieldValue.split('@');
    if (versionFromPackageJson &&
        // If it's a URL, it's not a valid range by default, unless users set `COREPACK_ENABLE_UNSAFE_CUSTOM_URLS=1`.
        // In the unsafe case, there's no way to reliably pare out the version since it could be anything, e.g. http://mydomain.com/bin/yarn.js.
        // See: https://github.com/nodejs/corepack/blob/2b43f26/sources/corepackUtils.ts#L110-L112
        !URL.canParse(versionFromPackageJson) &&
        packageManagerFromPackageJson === requestedPackageManager &&
        versionFromPackageJson) {
        // The range could have a validation hash attached, like "3.2.3+sha224.953c8233f7a92884eee2de69a1b92d1f2ec1655e66d08071ba9a02fa".
        // We just want to parse out the "<major>.<minor>.<patch>". Semver treats "+" as a build, which is not included in the resulting version.
        return (0, semver_1.parse)(versionFromPackageJson)?.version ?? null;
    }
    return null;
}
/**
 * Checks for a project level npmrc file by crawling up the file tree until
 * hitting a package.json file, as this is how npm finds them as well.
 */
function findFileInPackageJsonDirectory(file, directory = process.cwd()) {
    while (!(0, fs_1.existsSync)((0, path_1.join)(directory, 'package.json'))) {
        if (directory === workspace_root_1.workspaceRoot) {
            // we reached the workspace root and we didn't find a package.json file
            return null;
        }
        directory = (0, path_1.dirname)(directory);
    }
    const path = (0, path_1.join)(directory, file);
    return (0, fs_1.existsSync)(path) ? path : null;
}
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
function modifyYarnRcYmlToFitNewDirectory(contents) {
    const { parseSyml, stringifySyml } = require('./yarn-syml');
    const parsed = parseSyml(contents);
    if (parsed.yarnPath) {
        // yarnPath is relative to the workspace root, so we need to make it relative
        // to the new directory s.t. it still points to the same yarn binary.
        delete parsed.yarnPath;
    }
    if (parsed.plugins) {
        // Plugins specified by a string are relative paths from workspace root.
        // ex: https://yarnpkg.com/advanced/plugin-tutorial#writing-our-first-plugin
        delete parsed.plugins;
    }
    return stringifySyml(parsed);
}
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
function modifyYarnRcToFitNewDirectory(contents) {
    const lines = contents.split('\n');
    const yarnPathIndex = lines.findIndex((line) => line.startsWith('yarn-path'));
    if (yarnPathIndex !== -1) {
        lines.splice(yarnPathIndex, 1);
    }
    return lines.join('\n');
}
function copyPackageManagerConfigurationFiles(root, destination) {
    for (const packageManagerConfigFile of [
        '.npmrc',
        '.yarnrc',
        '.yarnrc.yml',
        'bunfig.toml',
    ]) {
        // f is an absolute path, including the {workspaceRoot}.
        const f = findFileInPackageJsonDirectory(packageManagerConfigFile, root);
        if (f) {
            // Destination should be the same relative path from the {workspaceRoot},
            // but now relative to the destination. `relative` makes `{workspaceRoot}/some/path`
            // look like `./some/path`, and joining that gets us `{destination}/some/path
            const destinationPath = (0, path_1.join)(destination, (0, path_1.relative)(root, f));
            switch (packageManagerConfigFile) {
                case '.npmrc': {
                    (0, fs_1.copyFileSync)(f, destinationPath);
                    break;
                }
                case '.yarnrc': {
                    const updated = modifyYarnRcToFitNewDirectory((0, fileutils_1.readFileIfExisting)(f));
                    (0, fs_1.writeFileSync)(destinationPath, updated);
                    break;
                }
                case '.yarnrc.yml': {
                    const updated = modifyYarnRcYmlToFitNewDirectory((0, fileutils_1.readFileIfExisting)(f));
                    (0, fs_1.writeFileSync)(destinationPath, updated);
                    break;
                }
                case 'bunfig.toml': {
                    (0, fs_1.copyFileSync)(f, destinationPath);
                    break;
                }
            }
        }
    }
}
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
function createTempNpmDirectory(skipCopy = false) {
    const dir = (0, tmp_1.dirSync)().name;
    // A package.json is needed for pnpm pack and for .npmrc to resolve
    (0, fileutils_1.writeJsonFile)(`${dir}/package.json`, {});
    if (!skipCopy) {
        const isNonJs = !(0, fs_1.existsSync)((0, path_1.join)(workspace_root_1.workspaceRoot, 'package.json'));
        copyPackageManagerConfigurationFiles(isNonJs ? (0, installation_directory_1.getNxInstallationPath)(workspace_root_1.workspaceRoot) : workspace_root_1.workspaceRoot, dir);
    }
    const cleanup = async () => {
        try {
            await (0, promises_1.rm)(dir, { recursive: true, force: true });
        }
        catch {
            // It's okay if this fails, the OS will clean it up eventually
        }
    };
    return { dir, cleanup };
}
/**
 * Returns the resolved version for a given package and version tag using the
 * NPM registry (when using Yarn it will fall back to NPM to fetch the info).
 */
async function resolvePackageVersionUsingRegistry(packageName, version) {
    try {
        let resolvedVersion = version;
        const manager = (0, catalog_1.getCatalogManager)(workspace_root_1.workspaceRoot);
        if (manager?.isCatalogReference(version)) {
            resolvedVersion = manager.resolveCatalogReference(workspace_root_1.workspaceRoot, packageName, version);
            if (!resolvedVersion) {
                throw new Error(`Unable to resolve catalog reference ${packageName}@${version}.`);
            }
        }
        const result = await packageRegistryView(packageName, resolvedVersion, 'version');
        if (!result) {
            throw new Error(`Unable to resolve version ${packageName}@${resolvedVersion}.`);
        }
        const lines = result.split('\n');
        if (lines.length === 1) {
            return lines[0];
        }
        /**
         * The output contains multiple lines ordered by release date, so the last
         * version might not be the last one in the list. We need to sort it. Each
         * line looks like:
         *
         * <package>@<version> '<version>'
         */
        const finalResolvedVersion = lines
            .map((line) => line.split(' ')[1])
            .sort()
            .pop()
            .replace(/'/g, '');
        return finalResolvedVersion;
    }
    catch {
        throw new Error(`Unable to resolve version ${packageName}@${version}.`);
    }
}
/**
 * Return the resolved version for a given package and version tag using by
 * installing it in a temporary directory and fetching the version from the
 * package.json.
 */
async function resolvePackageVersionUsingInstallation(packageName, version) {
    const { dir, cleanup } = createTempNpmDirectory();
    try {
        let resolvedVersion = version;
        const manager = (0, catalog_1.getCatalogManager)(workspace_root_1.workspaceRoot);
        if (manager.isCatalogReference(version)) {
            resolvedVersion = manager.resolveCatalogReference(workspace_root_1.workspaceRoot, packageName, version);
            if (!resolvedVersion) {
                throw new Error(`Unable to resolve catalog reference ${packageName}@${version}.`);
            }
        }
        const pmc = getPackageManagerCommand();
        await execAsync(`${pmc.add} ${packageName}@${resolvedVersion}`, {
            cwd: dir,
            windowsHide: true,
        });
        const { packageJson } = (0, package_json_1.readModulePackageJson)(packageName, [dir]);
        return packageJson.version;
    }
    finally {
        await cleanup();
    }
}
async function packageRegistryView(pkg, version, args) {
    let pm = detectPackageManager();
    if (pm === 'yarn' || pm === 'bun') {
        /**
         * yarn has `yarn info` but it behaves differently than (p)npm,
         * which makes it's usage unreliable
         *
         * @see https://github.com/nrwl/nx/pull/9667#discussion_r842553994
         *
         * Bun has a pm ls function but it only relates to its lockfile
         * and acts differently from all other package managers
         * from Jarred: "it probably would be bun pm view <package-name>"
         */
        pm = 'npm';
    }
    const { stdout } = await execAsync(`${pm} view ${pkg}@${version} ${args}`, {
        windowsHide: true,
    });
    return stdout.toString().trim();
}
async function packageRegistryPack(cwd, pkg, version) {
    /**
     * Only `npm pack` supports downloading a tarball of a specified remote
     * package. `yarn` packs the active workspace, `pnpm pack` only packs
     * the local project, and `bun` doesn't support pack.
     *
     * @see https://github.com/nrwl/nx/pull/9667#discussion_r842553994
     */
    const pm = 'npm';
    const { stdout } = await execAsync(`${pm} pack ${pkg}@${version}`, {
        cwd,
        windowsHide: true,
    });
    const tarballPath = stdout.trim();
    return { tarballPath };
}
/**
 * Gets the workspaces defined in the package manager configuration.
 * @returns workspaces defined in the package manager configuration, empty array if none are defined
 */
function getPackageWorkspaces(packageManager = detectPackageManager(), root = workspace_root_1.workspaceRoot) {
    let workspaces;
    if (packageManager === 'npm' ||
        packageManager === 'yarn' ||
        packageManager === 'bun') {
        const packageJson = (0, file_utils_1.readPackageJson)(root);
        workspaces = packageJson.workspaces;
    }
    else if (packageManager === 'pnpm') {
        const pnpmWorkspacePath = (0, path_1.join)(root, 'pnpm-workspace.yaml');
        if ((0, fs_1.existsSync)(pnpmWorkspacePath)) {
            const { packages } = (0, fileutils_1.readYamlFile)(pnpmWorkspacePath) ?? {};
            workspaces = packages;
        }
    }
    return workspaces ?? [];
}
/**
 * Adds a package to the workspaces defined in the package manager configuration.
 * If the package is already included in the workspaces, it will not be added again.
 * @param packageManager The package manager to use. If not provided, it will be detected based on the lock file.
 * @param workspaces The workspaces to add the package to. Defaults to the workspaces defined in the package manager configuration.
 * @param root The directory the commands will be ran inside of. Defaults to the current workspace's root.
 * @param packagePath The path of the package to add to the workspaces
 */
function addPackagePathToWorkspaces(packagePath, packageManager = detectPackageManager(), workspaces = getPackageWorkspaces(packageManager), root = workspace_root_1.workspaceRoot) {
    if (packageManager === 'npm' ||
        packageManager === 'yarn' ||
        packageManager === 'bun') {
        workspaces.push(packagePath);
        const packageJson = (0, file_utils_1.readPackageJson)(root);
        const updatedPackageJson = {
            ...packageJson,
            workspaces,
        };
        const packageJsonPath = (0, path_1.join)(root, 'package.json');
        (0, fileutils_1.writeJsonFile)(packageJsonPath, updatedPackageJson);
    }
    else if (packageManager === 'pnpm') {
        const pnpmWorkspacePath = (0, path_1.join)(root, 'pnpm-workspace.yaml');
        if ((0, fs_1.existsSync)(pnpmWorkspacePath)) {
            const pnpmWorkspaceDocument = (0, yaml_1.parseDocument)((0, fileutils_1.readFileIfExisting)(pnpmWorkspacePath));
            const pnpmWorkspaceContents = pnpmWorkspaceDocument.contents;
            if (!pnpmWorkspaceContents) {
                (0, fs_1.writeFileSync)(pnpmWorkspacePath, (0, yaml_1.stringify)({
                    packages: [packagePath],
                }));
            }
            else if (pnpmWorkspaceContents instanceof yaml_1.YAMLMap) {
                const packages = pnpmWorkspaceContents.items.find((item) => {
                    return item.key instanceof yaml_1.Scalar
                        ? item.key?.value === 'packages'
                        : item.key === 'packages';
                });
                if (packages) {
                    if (packages.value instanceof yaml_1.YAMLSeq === false) {
                        packages.value = new yaml_1.YAMLSeq();
                    }
                    packages.value.items ??= [];
                    packages.value.items.push(packagePath);
                }
                else {
                    // if the 'packages' key doesn't exist, create it
                    const packagesSeq = new yaml_1.YAMLSeq();
                    packagesSeq.items ??= [];
                    packagesSeq.items.push(packagePath);
                    pnpmWorkspaceDocument.add(pnpmWorkspaceDocument.createPair('packages', packagesSeq));
                }
                (0, fs_1.writeFileSync)(pnpmWorkspacePath, (0, yaml_1.stringify)(pnpmWorkspaceContents));
            }
        }
        else {
            // If the file doesn't exist, create it
            (0, fs_1.writeFileSync)(pnpmWorkspacePath, (0, yaml_1.stringify)({
                packages: [packagePath],
            }));
        }
    }
}
