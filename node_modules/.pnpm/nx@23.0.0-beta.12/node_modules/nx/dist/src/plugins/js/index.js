"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDependencies = exports.createNodesV2 = exports.name = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
const perf_hooks_1 = require("perf_hooks");
const file_hasher_1 = require("../../hasher/file-hasher");
const plugins_1 = require("../../project-graph/plugins");
const cache_directory_1 = require("../../utils/cache-directory");
const globs_1 = require("../../utils/globs");
const package_manager_1 = require("../../utils/package-manager");
const versions_1 = require("../../utils/versions");
const logger_1 = require("../../utils/logger");
const plugin_cache_utils_1 = require("../../utils/plugin-cache-utils");
const workspace_root_1 = require("../../utils/workspace-root");
const bun_parser_1 = require("./lock-file/bun-parser");
const lock_file_1 = require("./lock-file/lock-file");
const build_dependencies_1 = require("./project-graph/build-dependencies/build-dependencies");
const config_1 = require("./utils/config");
exports.name = 'nx/js/dependencies-and-lockfile';
// Separate in-memory caches
let cachedExternalNodes;
let cachedKeyMap;
exports.createNodesV2 = [
    (0, globs_1.combineGlobPatterns)(lock_file_1.LOCKFILES),
    (files, _, context) => {
        return (0, plugins_1.createNodesFromFiles)(internalCreateNodes, files, _, context);
    },
];
function internalCreateNodes(lockFile, _, context) {
    const pluginConfig = (0, config_1.jsPluginConfig)(context.nxJsonConfiguration);
    if (!pluginConfig.analyzeLockfile) {
        return {};
    }
    const packageManager = (0, package_manager_1.detectPackageManager)(workspace_root_1.workspaceRoot);
    // Only process the correct lockfile
    if (lockFile !== (0, lock_file_1.getLockFileName)(packageManager)) {
        return {};
    }
    const lockFilePath = (0, path_1.join)(workspace_root_1.workspaceRoot, lockFile);
    const lockFileContents = packageManager !== 'bun'
        ? (0, fs_1.readFileSync)(lockFilePath, 'utf-8')
        : (0, bun_parser_1.readBunLockFile)(lockFilePath);
    const lockFileHash = getLockFileHash(lockFileContents);
    if (!lockFileNeedsReprocessing(lockFileHash, externalNodesHashFile)) {
        const { nodes, keyMap } = readCachedExternalNodes();
        cachedExternalNodes = nodes;
        cachedKeyMap = keyMap;
        return {
            externalNodes: nodes,
        };
    }
    const { nodes: externalNodes, keyMap } = (0, lock_file_1.getLockFileNodes)(packageManager, lockFileContents, lockFileHash, context);
    cachedExternalNodes = externalNodes;
    cachedKeyMap = keyMap;
    writeExternalNodesCache(lockFileHash, externalNodes, keyMap);
    return {
        externalNodes,
    };
}
const createDependencies = (_, ctx) => {
    const pluginConfig = (0, config_1.jsPluginConfig)(ctx.nxJsonConfiguration);
    const packageManager = (0, package_manager_1.detectPackageManager)(workspace_root_1.workspaceRoot);
    let lockfileDependencies = [];
    // lockfile may not exist yet
    if (pluginConfig.analyzeLockfile &&
        (0, lock_file_1.lockFileExists)(packageManager) &&
        cachedExternalNodes) {
        const lockFilePath = (0, path_1.join)(workspace_root_1.workspaceRoot, (0, lock_file_1.getLockFileName)(packageManager));
        const lockFileContents = packageManager !== 'bun'
            ? (0, fs_1.readFileSync)(lockFilePath, 'utf-8')
            : (0, bun_parser_1.readBunLockFile)(lockFilePath);
        const lockFileHash = getLockFileHash(lockFileContents);
        if (!lockFileNeedsReprocessing(lockFileHash, dependenciesHashFile)) {
            lockfileDependencies = readCachedDependencies();
        }
        else {
            lockfileDependencies = (0, lock_file_1.getLockFileDependencies)(packageManager, lockFileContents, lockFileHash, ctx, cachedKeyMap);
            writeDependenciesCache(lockFileHash, lockfileDependencies);
        }
    }
    perf_hooks_1.performance.mark('build typescript dependencies - start');
    const explicitProjectDependencies = (0, build_dependencies_1.buildExplicitDependencies)(pluginConfig, ctx);
    perf_hooks_1.performance.mark('build typescript dependencies - end');
    perf_hooks_1.performance.measure('build typescript dependencies', 'build typescript dependencies - start', 'build typescript dependencies - end');
    return lockfileDependencies.concat(explicitProjectDependencies);
};
exports.createDependencies = createDependencies;
function getLockFileHash(lockFileContents) {
    return (0, file_hasher_1.hashArray)([versions_1.nxVersion, lockFileContents]);
}
// Serialize keyMap to JSON-friendly format
function serializeKeyMap(keyMap) {
    const serialized = {};
    for (const [key, value] of keyMap.entries()) {
        if (value instanceof Set) {
            // pnpm: Map<string, Set<ProjectGraphExternalNode>>
            serialized[key] = Array.from(value).map((node) => node.name);
        }
        else if (value && typeof value === 'object' && 'name' in value) {
            // npm/yarn: Map<string, ProjectGraphExternalNode>
            serialized[key] = value.name;
        }
        else {
            serialized[key] = value;
        }
    }
    return serialized;
}
// Deserialize keyMap from JSON format using ctx.externalNodes
function deserializeKeyMap(serialized, externalNodes) {
    const keyMap = new Map();
    for (const [key, value] of Object.entries(serialized)) {
        if (Array.isArray(value)) {
            // pnpm: reconstruct Set<ProjectGraphExternalNode>
            const nodes = value
                .map((nodeName) => externalNodes[nodeName])
                .filter(Boolean);
            keyMap.set(key, new Set(nodes));
        }
        else if (typeof value === 'string') {
            // npm/yarn: reconstruct ProjectGraphExternalNode
            const node = externalNodes[value];
            if (node) {
                keyMap.set(key, node);
            }
        }
        else {
            keyMap.set(key, value);
        }
    }
    return keyMap;
}
function lockFileNeedsReprocessing(lockHash, hashFilePath) {
    try {
        return (0, fs_1.readFileSync)(hashFilePath).toString() !== lockHash;
    }
    catch {
        return true;
    }
}
// External nodes cache functions
function writeExternalNodesCache(hash, nodes, keyMap) {
    const serializedKeyMap = serializeKeyMap(keyMap);
    const cacheData = { nodes, keyMap: serializedKeyMap };
    const content = safeStringify(cacheData);
    if (content === undefined) {
        logger_1.logger.warn(`Failed to serialize external nodes cache. Skipping cache write.`);
        tryRemoveFile(externalNodesCache);
        tryRemoveFile(externalNodesHashFile);
        return;
    }
    (0, plugin_cache_utils_1.safeWriteFileCache)(externalNodesCache, content);
    if ((0, fs_1.existsSync)(externalNodesCache)) {
        (0, plugin_cache_utils_1.safeWriteFileCache)(externalNodesHashFile, hash);
    }
}
function readCachedExternalNodes() {
    const { nodes, keyMap } = JSON.parse((0, fs_1.readFileSync)(externalNodesCache, 'utf-8'));
    return { nodes, keyMap: deserializeKeyMap(keyMap, nodes) };
}
// Dependencies cache functions
function writeDependenciesCache(hash, dependencies) {
    const content = safeStringify(dependencies);
    if (content === undefined) {
        logger_1.logger.warn(`Failed to serialize dependencies cache. Skipping cache write.`);
        tryRemoveFile(dependenciesCache);
        tryRemoveFile(dependenciesHashFile);
        return;
    }
    (0, plugin_cache_utils_1.safeWriteFileCache)(dependenciesCache, content);
    if ((0, fs_1.existsSync)(dependenciesCache)) {
        (0, plugin_cache_utils_1.safeWriteFileCache)(dependenciesHashFile, hash);
    }
}
function safeStringify(data) {
    try {
        return JSON.stringify(data, null, 2);
    }
    catch {
        return undefined;
    }
}
function tryRemoveFile(path) {
    try {
        if ((0, fs_1.existsSync)(path)) {
            (0, fs_1.rmSync)(path);
        }
    }
    catch {
        // Best effort
    }
}
function readCachedDependencies() {
    return JSON.parse((0, fs_1.readFileSync)(dependenciesCache).toString());
}
// Cache file paths
const externalNodesHashFile = (0, path_1.join)(cache_directory_1.workspaceDataDirectory, 'lockfile-nodes.hash');
const dependenciesHashFile = (0, path_1.join)(cache_directory_1.workspaceDataDirectory, 'lockfile-dependencies.hash');
const externalNodesCache = (0, path_1.join)(cache_directory_1.workspaceDataDirectory, 'parsed-lock-file.nodes.json');
const dependenciesCache = (0, path_1.join)(cache_directory_1.workspaceDataDirectory, 'parsed-lock-file.dependencies.json');
