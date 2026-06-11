"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BunLockfileParseError = exports.BUN_TEXT_LOCK_FILE = exports.BUN_LOCK_FILE = void 0;
exports.readBunLockFile = readBunLockFile;
exports.getBunTextLockfileDependencies = getBunTextLockfileDependencies;
exports.clearCache = clearCache;
exports.getBunTextLockfileNodes = getBunTextLockfileNodes;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const semver_1 = require("semver");
const project_graph_1 = require("../../../config/project-graph");
const file_hasher_1 = require("../../../hasher/file-hasher");
const project_graph_builder_1 = require("../../../project-graph/project-graph-builder");
const json_1 = require("../../../utils/json");
const DEPENDENCY_TYPES = [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
];
exports.BUN_LOCK_FILE = 'bun.lockb';
exports.BUN_TEXT_LOCK_FILE = 'bun.lock';
let currentLockFileHash;
let cachedParsedLockFile;
let cachedPackageIndex;
const keyMap = new Map();
const packageVersions = new Map();
const specParseCache = new Map();
// Structured error types for better error handling
class BunLockfileParseError extends Error {
    constructor(message, cause) {
        super(message);
        this.cause = cause;
        this.name = 'BunLockfileParseError';
    }
}
exports.BunLockfileParseError = BunLockfileParseError;
function readBunLockFile(lockFilePath) {
    if (lockFilePath.endsWith(exports.BUN_TEXT_LOCK_FILE)) {
        return (0, node_fs_1.readFileSync)(lockFilePath, { encoding: 'utf-8' });
    }
    return (0, node_child_process_1.execSync)(`bun ${lockFilePath}`, {
        encoding: 'utf-8',
        maxBuffer: 1024 * 1024 * 10,
        windowsHide: true,
    });
}
function getBunTextLockfileDependencies(lockFileContent, lockFileHash, ctx) {
    try {
        const { lockFile, index } = parseLockFile(lockFileContent, lockFileHash);
        const dependencies = [];
        const workspacePackages = new Set(Object.keys(ctx.projects));
        if (!lockFile.workspaces || Object.keys(lockFile.workspaces).length === 0) {
            return dependencies;
        }
        const packageDeps = processPackageToPackageDependencies(lockFile, index, ctx, workspacePackages);
        dependencies.push(...packageDeps);
        return dependencies;
    }
    catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`Failed to get Bun lockfile dependencies: ${error.message}`);
    }
}
/** @internal */
function clearCache() {
    currentLockFileHash = undefined;
    cachedParsedLockFile = undefined;
    cachedPackageIndex = undefined;
    keyMap.clear();
    packageVersions.clear();
    specParseCache.clear();
}
// ===== UTILITY FUNCTIONS =====
function getCachedSpecInfo(resolvedSpec) {
    let cached = specParseCache.get(resolvedSpec);
    if (!cached) {
        const { name, version } = parseResolvedSpec(resolvedSpec);
        const protocol = getProtocolFromResolvedSpec(resolvedSpec);
        cached = { name, version, protocol };
        specParseCache.set(resolvedSpec, cached);
    }
    return cached;
}
function getProtocolFromResolvedSpec(resolvedSpec) {
    // Handle scoped packages properly
    let protocolAndSpec;
    if (resolvedSpec.startsWith('@')) {
        // For scoped packages, find the second @ which separates name from protocol
        const secondAtIndex = resolvedSpec.indexOf('@', 1);
        if (secondAtIndex === -1) {
            return 'npm'; // Default fallback
        }
        protocolAndSpec = resolvedSpec.substring(secondAtIndex + 1);
    }
    else {
        // For non-scoped packages, find the first @ which separates name from protocol
        const firstAtIndex = resolvedSpec.indexOf('@');
        if (firstAtIndex === -1) {
            return 'npm'; // Default fallback
        }
        protocolAndSpec = resolvedSpec.substring(firstAtIndex + 1);
    }
    const colonIndex = protocolAndSpec.indexOf(':');
    if (colonIndex === -1) {
        return 'npm'; // No protocol specified, default to npm
    }
    return protocolAndSpec.substring(0, colonIndex);
}
function parseResolvedSpec(resolvedSpec) {
    // Handle different resolution formats:
    // - "package-name@npm:1.0.0"
    // - "@scope/package-name@npm:1.0.0"
    // - "package-name@github:user/repo#commit"
    // - "package-name@file:./path"
    // - "package-name@https://example.com/package.tgz"
    // - "alias-name@npm:actual-package@version" (ALIAS FORMAT)
    // Handle scoped packages properly - they have an extra @ at the beginning
    // Format: @scope/package@protocol:spec
    let name;
    let protocolAndSpec;
    if (resolvedSpec.startsWith('@')) {
        // For scoped packages, find the second @ which separates name from protocol
        const secondAtIndex = resolvedSpec.indexOf('@', 1);
        if (secondAtIndex === -1) {
            return { name: '', version: '' };
        }
        name = resolvedSpec.substring(0, secondAtIndex);
        protocolAndSpec = resolvedSpec.substring(secondAtIndex + 1);
    }
    else {
        // For non-scoped packages, find the first @ which separates name from protocol
        const firstAtIndex = resolvedSpec.indexOf('@');
        if (firstAtIndex === -1) {
            return { name: '', version: '' };
        }
        name = resolvedSpec.substring(0, firstAtIndex);
        protocolAndSpec = resolvedSpec.substring(firstAtIndex + 1);
    }
    // Parse protocol and spec
    const colonIndex = protocolAndSpec.indexOf(':');
    // Handle specs without protocol prefix (e.g., "package@1.0.0" instead of "package@npm:1.0.0")
    if (colonIndex === -1) {
        // No protocol specified, treat as npm package with direct version
        return { name, version: protocolAndSpec };
    }
    const protocol = protocolAndSpec.substring(0, colonIndex);
    const spec = protocolAndSpec.substring(colonIndex + 1);
    if (protocol === 'npm') {
        // For npm protocol, spec should always be in format: package@version
        // Examples:
        // - Regular: "package@npm:package@1.0.0" -> version: "1.0.0"
        // - Alias: "alias@npm:real-package@1.0.0" -> version: "npm:real-package@1.0.0"
        // Extract the package name and version from the spec
        const atIndex = spec.lastIndexOf('@');
        if (atIndex === -1) {
            // Malformed spec, return as-is
            return { name, version: spec };
        }
        const specPackageName = spec.substring(0, atIndex);
        const specVersion = spec.substring(atIndex + 1);
        if (specPackageName === name) {
            // Regular npm package: "package@npm:package@1.0.0" -> version: "1.0.0"
            return { name, version: specVersion };
        }
        else {
            // Alias package: "alias@npm:real-package@1.0.0" -> version: "npm:real-package@1.0.0"
            return { name, version: `npm:${spec}` };
        }
    }
    else if (protocol === 'workspace') {
        // Workspace dependencies use the workspace path as version
        return { name, version: `workspace:${spec}` };
    }
    else if (protocol === 'github' || protocol === 'git') {
        // Extract commit hash from GitHub/Git reference
        // Format: user/repo#commit-hash or repo-url#commit-hash
        const gitMatch = spec.match(/^(.+?)#(.+)$/);
        if (gitMatch) {
            const [, repo, commit] = gitMatch;
            return { name, version: `${protocol}:${repo}#${commit}` };
        }
        else {
            return { name, version: `${protocol}:${spec}` };
        }
    }
    else if (protocol === 'file' || protocol === 'link') {
        // File/Link dependencies use the file path as version
        return { name, version: `${protocol}:${spec}` };
    }
    else if (protocol === 'https' || protocol === 'http') {
        // Tarball dependencies use the full URL as version
        return { name, version: `${protocol}:${spec}` };
    }
    else {
        // For any other protocols, use the original spec as version
        return { name, version: resolvedSpec };
    }
}
function calculatePackageHash(packageData, lockFile, name, version) {
    const [resolvedSpec, tarballUrl, metadata, hash] = packageData;
    // For NPM packages (4 elements), use the integrity hash
    if (packageData.length === 4 && hash && typeof hash === 'string') {
        // Use better hash from manifests if available
        if (lockFile.manifests && lockFile.manifests[`${name}@${version}`]) {
            const manifest = lockFile.manifests[`${name}@${version}`];
            if (manifest.dist && manifest.dist.shasum) {
                return manifest.dist.shasum;
            }
        }
        return hash;
    }
    // For other package types, calculate hash from available data
    const hashData = [resolvedSpec];
    if (tarballUrl && typeof tarballUrl === 'string')
        hashData.push(tarballUrl);
    if (metadata)
        hashData.push(JSON.stringify(metadata));
    if (hash && typeof hash === 'string')
        hashData.push(hash);
    return (0, file_hasher_1.hashArray)(hashData);
}
/**
 * Determines if a package is an alias by comparing the package key with the resolved spec name
 * In Bun lockfiles, aliases are identified when the package key differs from the resolved package name
 */
function isAliasPackage(packageKey, resolvedPackageName) {
    return packageKey !== resolvedPackageName;
}
/**
 * Build a pre-computed index for O(1) lookups
 * This is the key optimization - we do one pass through all packages
 * and build indexes that can be queried in O(1) time later
 */
function buildPackageIndex(lockFile) {
    const byName = new Map();
    const workspaceNames = new Set();
    const workspacePaths = new Set();
    const packagesWithWorkspaceVariants = new Set();
    const patchedPackages = new Set();
    // Collect workspace paths
    if (lockFile.workspaces) {
        for (const workspacePath of Object.keys(lockFile.workspaces)) {
            if (workspacePath !== '') {
                workspacePaths.add(workspacePath);
            }
        }
    }
    // Collect workspace package names from workspacePackages field
    if (lockFile.workspacePackages) {
        for (const packageInfo of Object.values(lockFile.workspacePackages)) {
            workspaceNames.add(packageInfo.name);
        }
    }
    // Collect patched package names
    if (lockFile.patches) {
        for (const packageName of Object.keys(lockFile.patches)) {
            patchedPackages.add(packageName);
        }
    }
    // Collect workspace package names from workspace dependencies
    if (lockFile.workspaces) {
        for (const workspace of Object.values(lockFile.workspaces)) {
            const allDeps = {
                ...workspace.dependencies,
                ...workspace.devDependencies,
                ...workspace.optionalDependencies,
                ...workspace.peerDependencies,
            };
            for (const [depName, depVersion] of Object.entries(allDeps)) {
                if (depVersion.startsWith('workspace:') ||
                    depVersion.startsWith('file:')) {
                    workspaceNames.add(depName);
                }
            }
        }
    }
    // Single pass through all packages to build indexes
    if (lockFile.packages) {
        for (const [packageKey, packageData] of Object.entries(lockFile.packages)) {
            if (!Array.isArray(packageData) || packageData.length < 1) {
                continue;
            }
            const resolvedSpec = packageData[0];
            if (typeof resolvedSpec !== 'string') {
                continue;
            }
            const { name, version, protocol } = getCachedSpecInfo(resolvedSpec);
            if (!name || !version) {
                continue;
            }
            // Track workspace packages from packages section
            if (protocol === 'workspace' || protocol === 'file') {
                workspaceNames.add(name);
            }
            // Check if this is a workspace-specific variant (e.g., "@quz/pkg1/lodash")
            if (packageKey.includes('/') && packageKey !== name) {
                // Check if it ends with a package name pattern
                const lastSlash = packageKey.lastIndexOf('/');
                if (lastSlash > 0) {
                    const possiblePackageName = packageKey.substring(lastSlash + 1);
                    const prefix = packageKey.substring(0, lastSlash);
                    // If the prefix is a workspace path or scoped package pattern
                    // For scoped packages, require prefix to contain '/' (e.g., "@scope/pkg")
                    // to avoid incorrectly matching just "@scope"
                    if (workspacePaths.has(prefix) ||
                        (prefix.startsWith('@') && prefix.includes('/'))) {
                        packagesWithWorkspaceVariants.add(possiblePackageName);
                    }
                }
            }
            // Build the byName index
            let entries = byName.get(name);
            if (!entries) {
                entries = [];
                byName.set(name, entries);
            }
            // Calculate hash once
            const hash = calculatePackageHash(packageData, lockFile, name, version);
            entries.push({ version, packageKey, hash });
        }
    }
    return {
        byName,
        workspaceNames,
        workspacePaths,
        packagesWithWorkspaceVariants,
        patchedPackages,
    };
}
function parseLockFile(lockFileContent, lockFileHash) {
    if (currentLockFileHash === lockFileHash &&
        cachedParsedLockFile &&
        cachedPackageIndex) {
        return { lockFile: cachedParsedLockFile, index: cachedPackageIndex };
    }
    clearCache();
    try {
        const result = (0, json_1.parseJson)(lockFileContent, {
            allowTrailingComma: true,
            expectComments: true,
        });
        // Validate basic structure
        if (!result || typeof result !== 'object') {
            throw new Error('Lockfile root must be an object');
        }
        // Validate lockfile version
        if (result.lockfileVersion !== undefined) {
            if (typeof result.lockfileVersion !== 'number') {
                throw new Error(`Lockfile version must be a number, got ${typeof result.lockfileVersion}`);
            }
            const supportedVersions = [0, 1];
            if (!supportedVersions.includes(result.lockfileVersion)) {
                throw new Error(`Unsupported lockfile version ${result.lockfileVersion}. Supported versions: ${supportedVersions.join(', ')}`);
            }
        }
        if (!result.packages || typeof result.packages !== 'object') {
            throw new Error('Lockfile packages section must be an object');
        }
        if (!result.workspaces || typeof result.workspaces !== 'object') {
            throw new Error('Lockfile workspaces section must be an object');
        }
        // Validate optional sections
        if (result.patches && typeof result.patches !== 'object') {
            throw new Error('Lockfile patches section must be an object');
        }
        if (result.manifests && typeof result.manifests !== 'object') {
            throw new Error('Lockfile manifests section must be an object');
        }
        if (result.workspacePackages &&
            typeof result.workspacePackages !== 'object') {
            throw new Error('Lockfile workspacePackages section must be an object');
        }
        // Validate structure of patches entries
        if (result.patches) {
            for (const [packageName, patchInfo] of Object.entries(result.patches)) {
                if (!patchInfo || typeof patchInfo !== 'object') {
                    throw new Error(`Invalid patch entry for package "${packageName}": must be an object`);
                }
                if (!patchInfo.path || typeof patchInfo.path !== 'string') {
                    throw new Error(`Invalid patch entry for package "${packageName}": path must be a string`);
                }
            }
        }
        // Validate structure of workspace packages entries
        if (result.workspacePackages) {
            for (const [packageName, packageInfo] of Object.entries(result.workspacePackages)) {
                if (!packageInfo || typeof packageInfo !== 'object') {
                    throw new Error(`Invalid workspace package entry for "${packageName}": must be an object`);
                }
                if (!packageInfo.name || typeof packageInfo.name !== 'string') {
                    throw new Error(`Invalid workspace package entry for "${packageName}": name must be a string`);
                }
                if (!packageInfo.version || typeof packageInfo.version !== 'string') {
                    throw new Error(`Invalid workspace package entry for "${packageName}": version must be a string`);
                }
            }
        }
        cachedParsedLockFile = result;
        currentLockFileHash = lockFileHash;
        // Build the optimized index
        cachedPackageIndex = buildPackageIndex(result);
        return { lockFile: result, index: cachedPackageIndex };
    }
    catch (error) {
        // Handle JSON parsing errors
        if (error.message.includes('JSON') ||
            error.message.includes('InvalidSymbol')) {
            throw new BunLockfileParseError('Failed to parse Bun lockfile: Invalid JSON syntax. Please check for syntax errors or regenerate the lockfile.', error);
        }
        // Re-throw parsing errors as-is (for validation errors)
        if (error instanceof Error) {
            throw error;
        }
        // Handle unknown errors
        throw new BunLockfileParseError(`Failed to parse Bun lockfile: ${error.message}`, error);
    }
}
// ===== MAIN EXPORT FUNCTIONS =====
function getBunTextLockfileNodes(lockFileContent, lockFileHash) {
    try {
        const { lockFile, index } = parseLockFile(lockFileContent, lockFileHash);
        const nodes = {};
        const localPackageVersions = new Map();
        if (!lockFile.packages || Object.keys(lockFile.packages).length === 0) {
            return nodes;
        }
        const packageEntries = Object.entries(lockFile.packages);
        for (const [packageKey, packageData] of packageEntries) {
            const result = processPackageEntry(packageKey, packageData, lockFile, index, keyMap, nodes, localPackageVersions);
            if (result.shouldContinue) {
                continue;
            }
        }
        createHoistedNodes(localPackageVersions, lockFile, index, keyMap, nodes);
        return nodes;
    }
    catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`Failed to get Bun lockfile nodes: ${error.message}`);
    }
}
function processPackageEntry(packageKey, packageData, lockFile, index, keyMap, nodes, packageVersions) {
    try {
        if (!Array.isArray(packageData) ||
            packageData.length < 1 ||
            packageData.length > 4) {
            console.warn(`Lockfile contains invalid package entry '${packageKey}'. Try regenerating the lockfile with 'bun install --force'.\nDebug: expected 1-4 elements, got ${JSON.stringify(packageData)}`);
            return { shouldContinue: true };
        }
        const [resolvedSpec] = packageData;
        if (typeof resolvedSpec !== 'string') {
            console.warn(`Lockfile contains corrupted package entry '${packageKey}'. Try regenerating the lockfile with 'bun install --force'.\nDebug: expected string, got ${typeof resolvedSpec}`);
            return { shouldContinue: true };
        }
        const { name, version, protocol } = getCachedSpecInfo(resolvedSpec);
        if (!name || !version) {
            console.warn(`Lockfile contains unrecognized package format. Try regenerating the lockfile with 'bun install --force'.\nDebug: could not parse resolved spec '${resolvedSpec}'`);
            return { shouldContinue: true };
        }
        // O(1) lookups using index
        if (index.workspaceNames.has(name)) {
            return { shouldContinue: true };
        }
        if (index.patchedPackages.has(name)) {
            return { shouldContinue: true };
        }
        if (protocol === 'workspace') {
            return { shouldContinue: true };
        }
        const isWorkspaceSpecific = isNestedPackageKey(packageKey, index);
        if (!isWorkspaceSpecific && isAliasPackage(packageKey, name)) {
            const aliasName = packageKey;
            const actualPackageName = name;
            const actualVersion = version;
            const aliasNodeKey = `npm:${aliasName}`;
            if (!keyMap.has(aliasNodeKey)) {
                const aliasNode = {
                    type: 'npm',
                    name: aliasNodeKey,
                    data: {
                        version: `npm:${actualPackageName}@${actualVersion}`,
                        packageName: aliasName,
                        hash: calculatePackageHash(packageData, lockFile, aliasName, `npm:${actualPackageName}@${actualVersion}`),
                    },
                };
                keyMap.set(aliasNodeKey, aliasNode);
                nodes[aliasNodeKey] = aliasNode;
            }
            const targetNodeKey = `npm:${actualPackageName}@${actualVersion}`;
            if (!keyMap.has(targetNodeKey)) {
                const targetNode = {
                    type: 'npm',
                    name: targetNodeKey,
                    data: {
                        version: actualVersion,
                        packageName: actualPackageName,
                        hash: calculatePackageHash(packageData, lockFile, actualPackageName, actualVersion),
                    },
                };
                keyMap.set(targetNodeKey, targetNode);
                nodes[targetNodeKey] = targetNode;
            }
            if (!packageVersions.has(aliasName)) {
                packageVersions.set(aliasName, new Set());
            }
            packageVersions
                .get(aliasName)
                .add(`npm:${actualPackageName}@${actualVersion}`);
            if (!packageVersions.has(actualPackageName)) {
                packageVersions.set(actualPackageName, new Set());
            }
            packageVersions.get(actualPackageName).add(actualVersion);
        }
        else {
            if (!packageVersions.has(name)) {
                packageVersions.set(name, new Set());
            }
            packageVersions.get(name).add(version);
            const nodeKey = `npm:${name}@${version}`;
            if (keyMap.has(nodeKey)) {
                nodes[nodeKey] = keyMap.get(nodeKey);
                return { shouldContinue: false };
            }
            const nodeHash = calculatePackageHash(packageData, lockFile, name, version);
            const node = {
                type: 'npm',
                name: nodeKey,
                data: {
                    version,
                    packageName: name,
                    hash: nodeHash,
                },
            };
            keyMap.set(nodeKey, node);
            nodes[nodeKey] = node;
        }
        return { shouldContinue: false };
    }
    catch (error) {
        console.warn(`Unable to process package '${packageKey}'. The lockfile may be corrupted. Try regenerating with 'bun install --force'.\nDebug: ${error.message}`);
        return { shouldContinue: true };
    }
}
function isWorkspaceOrPatchedPackage(packageName, index, workspacePackages) {
    return (workspacePackages.has(packageName) ||
        index.workspaceNames.has(packageName) ||
        index.patchedPackages.has(packageName));
}
function resolveAliasTarget(versionSpec) {
    if (!versionSpec.startsWith('npm:'))
        return null;
    const actualSpec = versionSpec.substring(4);
    const actualAtIndex = actualSpec.lastIndexOf('@');
    return {
        packageName: actualSpec.substring(0, actualAtIndex),
        version: actualSpec.substring(actualAtIndex + 1),
    };
}
function processPackageToPackageDependencies(lockFile, index, ctx, workspacePackages) {
    const dependencies = [];
    if (!lockFile.packages || Object.keys(lockFile.packages).length === 0) {
        return dependencies;
    }
    const packageEntries = Object.entries(lockFile.packages);
    for (const [packageKey, packageData] of packageEntries) {
        try {
            const packageDeps = processPackageForDependencies(packageKey, packageData, lockFile, index, ctx, workspacePackages);
            dependencies.push(...packageDeps);
        }
        catch (error) {
            continue;
        }
    }
    return dependencies;
}
function processPackageForDependencies(packageKey, packageData, lockFile, index, ctx, workspacePackages) {
    // O(1) checks using index
    if (index.workspaceNames.has(packageKey) ||
        isNestedPackageKey(packageKey, index)) {
        return [];
    }
    if (!Array.isArray(packageData) || packageData.length < 1) {
        return [];
    }
    const [resolvedSpec] = packageData;
    if (typeof resolvedSpec !== 'string') {
        return [];
    }
    const { name: sourcePackageName, version: sourceVersion } = getCachedSpecInfo(resolvedSpec);
    if (!sourcePackageName || !sourceVersion) {
        return [];
    }
    if (index.patchedPackages.has(sourcePackageName)) {
        return [];
    }
    const sourceNodeName = `npm:${sourcePackageName}@${sourceVersion}`;
    if (!ctx.externalNodes[sourceNodeName]) {
        return [];
    }
    const packageDependencies = extractPackageDependencies(packageData);
    if (!packageDependencies) {
        return [];
    }
    const dependencies = [];
    for (const depType of DEPENDENCY_TYPES) {
        const deps = packageDependencies[depType];
        if (!deps || typeof deps !== 'object')
            continue;
        const depDependencies = processDependencyEntries(deps, sourceNodeName, index, ctx, workspacePackages, lockFile.manifests);
        dependencies.push(...depDependencies);
    }
    return dependencies;
}
function extractPackageDependencies(packageData) {
    if (packageData.length >= 3 &&
        packageData[2] &&
        typeof packageData[2] === 'object') {
        return packageData[2];
    }
    if (packageData.length >= 2 &&
        packageData[1] &&
        typeof packageData[1] === 'object') {
        return packageData[1];
    }
    return undefined;
}
function processDependencyEntries(deps, sourceNodeName, index, ctx, workspacePackages, manifests) {
    const dependencies = [];
    const depsEntries = Object.entries(deps);
    for (const [packageName, versionSpec] of depsEntries) {
        try {
            const dependency = processSingleDependency(packageName, versionSpec, sourceNodeName, index, ctx, workspacePackages, manifests);
            if (dependency) {
                dependencies.push(dependency);
            }
        }
        catch (error) {
            continue;
        }
    }
    return dependencies;
}
function processSingleDependency(packageName, versionSpec, sourceNodeName, index, ctx, workspacePackages, manifests) {
    if (typeof packageName !== 'string' || typeof versionSpec !== 'string') {
        return null;
    }
    // O(1) check using index
    if (isWorkspaceOrPatchedPackage(packageName, index, workspacePackages)) {
        return null;
    }
    if (versionSpec.startsWith('workspace:')) {
        return null;
    }
    let targetPackageName = packageName;
    let targetVersion = versionSpec;
    const aliasTarget = resolveAliasTarget(versionSpec);
    if (aliasTarget) {
        targetPackageName = aliasTarget.packageName;
        targetVersion = aliasTarget.version;
    }
    else {
        // O(1) lookup using index instead of O(n) scan
        const resolvedVersion = findResolvedVersion(packageName, versionSpec, index, manifests);
        if (!resolvedVersion) {
            return null;
        }
        targetVersion = resolvedVersion;
    }
    const targetNodeName = resolveTargetNodeName(targetPackageName, targetVersion, ctx);
    if (!targetNodeName) {
        return null;
    }
    const dependency = {
        source: sourceNodeName,
        target: targetNodeName,
        type: project_graph_1.DependencyType.static,
    };
    try {
        (0, project_graph_builder_1.validateDependency)(dependency, ctx);
        return dependency;
    }
    catch (e) {
        return null;
    }
}
function resolveTargetNodeName(targetPackageName, targetVersion, ctx) {
    const hoistedNodeName = `npm:${targetPackageName}`;
    const versionedNodeName = `npm:${targetPackageName}@${targetVersion}`;
    if (ctx.externalNodes[versionedNodeName]) {
        return versionedNodeName;
    }
    if (ctx.externalNodes[hoistedNodeName]) {
        return hoistedNodeName;
    }
    return null;
}
// ===== HOISTING-RELATED FUNCTIONS =====
function createHoistedNodes(packageVersions, lockFile, index, keyMap, nodes) {
    for (const [packageName, versions] of packageVersions.entries()) {
        const hoistedNodeKey = `npm:${packageName}`;
        if (shouldCreateHoistedNode(packageName, lockFile, index)) {
            const hoistedVersion = getHoistedVersion(packageName, versions, index);
            if (hoistedVersion) {
                const versionedNodeKey = `npm:${packageName}@${hoistedVersion}`;
                const versionedNode = keyMap.get(versionedNodeKey);
                if (versionedNode && !keyMap.has(hoistedNodeKey)) {
                    const hoistedNode = {
                        type: 'npm',
                        name: hoistedNodeKey,
                        data: {
                            version: hoistedVersion,
                            packageName: packageName,
                            hash: versionedNode.data.hash,
                        },
                    };
                    keyMap.set(hoistedNodeKey, hoistedNode);
                    nodes[hoistedNodeKey] = hoistedNode;
                }
            }
        }
    }
}
/**
 * Checks if a package key represents a workspace-specific or nested dependency entry
 * These entries should not become external nodes, they are used only for resolution
 *
 * O(1) lookup using pre-computed index
 */
function isNestedPackageKey(packageKey, index) {
    // If the key doesn't contain '/', it's a direct package entry
    if (!packageKey.includes('/')) {
        return false;
    }
    // Check if this looks like a workspace-specific or nested entry
    const parts = packageKey.split('/');
    // For multi-part keys, check if the prefix is a workspace path or package name
    if (parts.length >= 2) {
        const prefix = parts.slice(0, -1).join('/');
        // O(1) check against known workspace paths
        if (index.workspacePaths.has(prefix)) {
            return true;
        }
        // O(1) check against workspace package names (scoped packages)
        if (index.workspaceNames.has(prefix)) {
            return true;
        }
        // Check for scoped workspace packages (e.g., "@quz/pkg1/lodash")
        // The prefix must contain '/' to be a scoped package (e.g., "@scope/pkg")
        // A prefix like just "@scope" without '/' is not a scoped package
        if (prefix.startsWith('@') && prefix.includes('/')) {
            return true;
        }
        // If the key looks like a simple scoped package (e.g., "@custom/lodash")
        // where parts.length === 2 and first part starts with '@', it's likely
        // a scoped package alias, not a nested dependency
        if (parts.length === 2 && parts[0].startsWith('@')) {
            return false;
        }
        // This could be dependency nesting (e.g., "is-even/is-odd")
        // These should be filtered out as they're not direct packages
        return true;
    }
    return false;
}
/**
 * Determines if a package should have a hoisted node created
 * O(1) lookup using pre-computed index
 */
function shouldCreateHoistedNode(packageName, lockFile, index) {
    if (!lockFile.workspaces || !lockFile.packages)
        return false;
    // First check if the package has a direct entry in the packages section
    // Direct entries should always be hoisted (they represent the canonical version)
    if (lockFile.packages[packageName]) {
        return true;
    }
    // For packages without direct entries, check if they appear in workspace dependencies
    // and don't have workspace-specific variants (which would cause conflicts)
    let appearsInWorkspace = false;
    for (const workspace of Object.values(lockFile.workspaces)) {
        const allDeps = {
            ...workspace.dependencies,
            ...workspace.devDependencies,
            ...workspace.optionalDependencies,
            ...workspace.peerDependencies,
        };
        if (allDeps[packageName]) {
            appearsInWorkspace = true;
            break;
        }
    }
    // O(1) check using pre-computed index
    if (appearsInWorkspace &&
        !index.packagesWithWorkspaceVariants.has(packageName)) {
        return true;
    }
    return false;
}
/**
 * Gets the version that should be used for a hoisted package
 * O(1) lookup using pre-computed index
 */
function getHoistedVersion(packageName, availableVersions, index) {
    // Use the index to find the main package version
    const candidates = index.byName.get(packageName);
    if (!candidates || candidates.length === 0) {
        return availableVersions.size > 0
            ? availableVersions.values().next().value
            : null;
    }
    // Look for the main package entry (the one where packageKey === packageName)
    const mainEntry = candidates.find((c) => c.packageKey === packageName);
    if (mainEntry && availableVersions.has(mainEntry.version)) {
        return mainEntry.version;
    }
    // Fallback: return the first available version
    return availableVersions.size > 0
        ? availableVersions.values().next().value
        : null;
}
/**
 * Finds the resolved version for a package given its version specification
 *
 * O(1) lookup using pre-computed index instead of O(n) scan through all packages
 */
function findResolvedVersion(packageName, versionSpec, index, manifests) {
    // O(1) lookup
    const candidates = index.byName.get(packageName);
    if (!candidates || candidates.length === 0) {
        // Try to find in manifests as fallback
        if (manifests) {
            const exactManifestKey = `${packageName}@${versionSpec}`;
            if (manifests[exactManifestKey]) {
                return versionSpec;
            }
            const manifestKey = Object.keys(manifests).find((key) => key.startsWith(`${packageName}@`));
            if (manifestKey) {
                const manifest = manifests[manifestKey];
                if (manifest.version) {
                    return manifest.version;
                }
            }
        }
        return null;
    }
    // Check for exact version match first (most common case)
    const exactMatch = candidates.find((c) => c.version === versionSpec);
    if (exactMatch) {
        return exactMatch.version;
    }
    // Handle different version specification patterns
    return findBestVersionMatch(versionSpec, candidates);
}
/**
 * Find the best version match for a given version specification
 * Only operates on the pre-filtered candidates array (usually 1-3 items)
 */
function findBestVersionMatch(versionSpec, candidates) {
    if (candidates.length === 0) {
        return null;
    }
    // For exact matches, return immediately (already checked above but defensive)
    const exactMatch = candidates.find((c) => c.version === versionSpec);
    if (exactMatch) {
        return exactMatch.version;
    }
    // Handle union ranges (||)
    if (versionSpec.includes('||')) {
        const ranges = versionSpec.split('||').map((r) => r.trim());
        for (const range of ranges) {
            const match = findBestVersionMatch(range, candidates);
            if (match) {
                return match;
            }
        }
        return null;
    }
    // Separate semver and non-semver versions
    const semverVersions = [];
    const nonSemverVersions = [];
    for (const c of candidates) {
        if (/^\d+\.\d+\.\d+/.test(c.version)) {
            semverVersions.push(c);
        }
        else {
            nonSemverVersions.push(c);
        }
    }
    // Handle non-semver versions (git, file, etc.)
    if (nonSemverVersions.length > 0) {
        const nonSemverMatch = nonSemverVersions.find((c) => c.version === versionSpec);
        if (nonSemverMatch) {
            return nonSemverMatch.version;
        }
        // If no exact match for non-semver, continue to semver matching
    }
    // Handle semver versions
    if (semverVersions.length === 0) {
        // No semver versions, return first non-semver if available
        return nonSemverVersions.length > 0 ? nonSemverVersions[0].version : null;
    }
    // Find all versions that satisfy the spec
    const satisfyingVersions = semverVersions.filter((candidate) => {
        try {
            return (0, semver_1.satisfies)(candidate.version, versionSpec);
        }
        catch (error) {
            // If semver fails, fall back to string comparison
            return candidate.version === versionSpec;
        }
    });
    if (satisfyingVersions.length === 0) {
        // No satisfying versions found, return the first semver candidate as fallback
        return semverVersions[0].version;
    }
    // Return the highest satisfying version (similar to npm behavior)
    // Sort versions in descending order and return the first one
    const sortedVersions = satisfyingVersions.sort((a, b) => {
        try {
            return b.version.localeCompare(a.version, undefined, {
                numeric: true,
                sensitivity: 'base',
            });
        }
        catch {
            // Fallback to string comparison
            return b.version.localeCompare(a.version);
        }
    });
    return sortedVersions[0].version;
}
