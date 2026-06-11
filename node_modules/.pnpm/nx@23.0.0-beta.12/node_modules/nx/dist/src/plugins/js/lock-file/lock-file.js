"use strict";
/**
 * This is the main API for accessing the lock file functionality.
 * It encapsulates the package manager specific logic and implementation details.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOCKFILES = void 0;
exports.getLockFileNodes = getLockFileNodes;
exports.getLockFileDependencies = getLockFileDependencies;
exports.lockFileExists = lockFileExists;
exports.getLockFileName = getLockFileName;
exports.getLockFilePath = getLockFilePath;
exports.createLockFile = createLockFile;
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const semver_1 = require("semver");
const fileutils_1 = require("../../../utils/fileutils");
const output_1 = require("../../../utils/output");
const package_manager_1 = require("../../../utils/package-manager");
const workspace_root_1 = require("../../../utils/workspace-root");
const bun_parser_1 = require("./bun-parser");
const npm_parser_1 = require("./npm-parser");
const pnpm_parser_1 = require("./pnpm-parser");
const project_graph_pruning_1 = require("./project-graph-pruning");
const package_json_1 = require("./utils/package-json");
const yarn_parser_1 = require("./yarn-parser");
const YARN_LOCK_FILE = 'yarn.lock';
const NPM_LOCK_FILE = 'package-lock.json';
const PNPM_LOCK_FILE = 'pnpm-lock.yaml';
exports.LOCKFILES = [
    YARN_LOCK_FILE,
    NPM_LOCK_FILE,
    PNPM_LOCK_FILE,
    bun_parser_1.BUN_LOCK_FILE,
    bun_parser_1.BUN_TEXT_LOCK_FILE,
];
const YARN_LOCK_PATH = (0, node_path_1.join)(workspace_root_1.workspaceRoot, YARN_LOCK_FILE);
const NPM_LOCK_PATH = (0, node_path_1.join)(workspace_root_1.workspaceRoot, NPM_LOCK_FILE);
const PNPM_LOCK_PATH = (0, node_path_1.join)(workspace_root_1.workspaceRoot, PNPM_LOCK_FILE);
const BUN_LOCK_PATH = (0, node_path_1.join)(workspace_root_1.workspaceRoot, bun_parser_1.BUN_LOCK_FILE);
const BUN_TEXT_LOCK_PATH = (0, node_path_1.join)(workspace_root_1.workspaceRoot, bun_parser_1.BUN_TEXT_LOCK_FILE);
/**
 * Parses lock file and maps dependencies and metadata to {@link LockFileGraph}
 */
function getLockFileNodes(packageManager, contents, lockFileHash, context) {
    try {
        if (packageManager === 'yarn') {
            const packageJson = (0, fileutils_1.readJsonFile)((0, node_path_1.join)(context.workspaceRoot, 'package.json'));
            return (0, yarn_parser_1.getYarnLockfileNodes)(contents, lockFileHash, packageJson);
        }
        if (packageManager === 'pnpm') {
            return (0, pnpm_parser_1.getPnpmLockfileNodes)(contents, lockFileHash);
        }
        if (packageManager === 'npm') {
            return (0, npm_parser_1.getNpmLockfileNodes)(contents, lockFileHash);
        }
        if (packageManager === 'bun') {
            const lockFilePath = getLockFilePath(packageManager);
            if (lockFilePath.endsWith(bun_parser_1.BUN_TEXT_LOCK_FILE)) {
                // Use new text-based parser
                const nodes = (0, bun_parser_1.getBunTextLockfileNodes)(contents, lockFileHash);
                return { nodes, keyMap: new Map() };
            }
            else {
                // Fallback to yarn parser for binary format
                const packageJson = (0, fileutils_1.readJsonFile)((0, node_path_1.join)(context.workspaceRoot, 'package.json'));
                return (0, yarn_parser_1.getYarnLockfileNodes)(contents, lockFileHash, packageJson);
            }
        }
    }
    catch (e) {
        if (!isPostInstallProcess()) {
            output_1.output.error({
                title: `Failed to parse ${packageManager} lockfile`,
                bodyLines: errorBodyLines(e),
            });
        }
        throw e;
    }
    throw new Error(`Unknown package manager: ${packageManager}`);
}
/**
 * Parses lock file and maps dependencies and metadata to {@link LockFileGraph}
 */
function getLockFileDependencies(packageManager, contents, lockFileHash, context, keyMap) {
    try {
        if (packageManager === 'yarn') {
            return (0, yarn_parser_1.getYarnLockfileDependencies)(contents, lockFileHash, context, keyMap);
        }
        if (packageManager === 'pnpm') {
            return (0, pnpm_parser_1.getPnpmLockfileDependencies)(contents, lockFileHash, context, keyMap);
        }
        if (packageManager === 'npm') {
            return (0, npm_parser_1.getNpmLockfileDependencies)(contents, lockFileHash, context, keyMap);
        }
        if (packageManager === 'bun') {
            const lockFilePath = getLockFilePath(packageManager);
            if (lockFilePath.endsWith(bun_parser_1.BUN_TEXT_LOCK_FILE)) {
                // Bun parser doesn't use keyMap
                return (0, bun_parser_1.getBunTextLockfileDependencies)(contents, lockFileHash, context);
            }
            else {
                // Fallback to yarn parser for binary format
                return (0, yarn_parser_1.getYarnLockfileDependencies)(contents, lockFileHash, context, keyMap);
            }
        }
    }
    catch (e) {
        if (!isPostInstallProcess()) {
            output_1.output.error({
                title: `Failed to parse ${packageManager} lockfile`,
                bodyLines: errorBodyLines(e),
            });
        }
        throw e;
    }
    throw new Error(`Unknown package manager: ${packageManager}`);
}
function lockFileExists(packageManager) {
    if (packageManager === 'yarn') {
        return (0, node_fs_1.existsSync)(YARN_LOCK_PATH);
    }
    if (packageManager === 'pnpm') {
        return (0, node_fs_1.existsSync)(PNPM_LOCK_PATH);
    }
    if (packageManager === 'npm') {
        return (0, node_fs_1.existsSync)(NPM_LOCK_PATH);
    }
    if (packageManager === 'bun') {
        return (0, node_fs_1.existsSync)(BUN_LOCK_PATH) || (0, node_fs_1.existsSync)(BUN_TEXT_LOCK_PATH);
    }
    throw new Error(`Unknown package manager ${packageManager} or lock file missing`);
}
/**
 * Returns lock file name based on the detected package manager in the root
 * @param packageManager
 * @returns
 */
function getLockFileName(packageManager) {
    if (packageManager === 'yarn') {
        return YARN_LOCK_FILE;
    }
    if (packageManager === 'pnpm') {
        return PNPM_LOCK_FILE;
    }
    if (packageManager === 'npm') {
        return NPM_LOCK_FILE;
    }
    if (packageManager === 'bun') {
        const lockFilePath = getLockFilePath(packageManager);
        return lockFilePath.endsWith(bun_parser_1.BUN_TEXT_LOCK_FILE)
            ? bun_parser_1.BUN_TEXT_LOCK_FILE
            : bun_parser_1.BUN_LOCK_FILE;
    }
    throw new Error(`Unknown package manager: ${packageManager}`);
}
function getLockFilePath(packageManager) {
    if (packageManager === 'yarn') {
        return YARN_LOCK_PATH;
    }
    if (packageManager === 'pnpm') {
        return PNPM_LOCK_PATH;
    }
    if (packageManager === 'npm') {
        return NPM_LOCK_PATH;
    }
    if (packageManager === 'bun') {
        try {
            // Check if text format exists first (prefer over binary)
            if ((0, node_fs_1.existsSync)(BUN_TEXT_LOCK_PATH)) {
                return BUN_TEXT_LOCK_PATH;
            }
            // Fall back to binary format
            if ((0, node_fs_1.existsSync)(BUN_LOCK_PATH)) {
                return BUN_LOCK_PATH;
            }
            const bunVersion = (0, node_child_process_1.execSync)('bun --version', { windowsHide: true })
                .toString()
                .trim();
            // Version-based fallback
            if ((0, semver_1.gte)(bunVersion, '1.2.0')) {
                return BUN_TEXT_LOCK_PATH;
            }
            return BUN_LOCK_PATH;
        }
        catch {
            return BUN_LOCK_PATH;
        }
    }
    throw new Error(`Unknown package manager: ${packageManager}`);
}
/**
 * Create lock file based on the root level lock file and (pruned) package.json
 *
 * @param packageJson
 * @param isProduction
 * @param packageManager
 * @returns
 */
function createLockFile(packageJson, graph, packageManager = (0, package_manager_1.detectPackageManager)(workspace_root_1.workspaceRoot)) {
    const normalizedPackageJson = (0, package_json_1.normalizePackageJson)(packageJson);
    const content = (0, node_fs_1.readFileSync)(getLockFilePath(packageManager), 'utf8');
    try {
        if (packageManager === 'yarn') {
            const prunedGraph = (0, project_graph_pruning_1.pruneProjectGraph)(graph, packageJson);
            return (0, yarn_parser_1.stringifyYarnLockfile)(prunedGraph, content, normalizedPackageJson);
        }
        if (packageManager === 'pnpm') {
            const prunedGraph = (0, project_graph_pruning_1.pruneProjectGraph)(graph, packageJson);
            return (0, pnpm_parser_1.stringifyPnpmLockfile)(prunedGraph, content, normalizedPackageJson, workspace_root_1.workspaceRoot);
        }
        if (packageManager === 'npm') {
            const prunedGraph = (0, project_graph_pruning_1.pruneProjectGraph)(graph, packageJson);
            return (0, npm_parser_1.stringifyNpmLockfile)(prunedGraph, content, normalizedPackageJson);
        }
        if (packageManager === 'bun') {
            output_1.output.log({
                title: "Unable to create bun lock files. Run bun install it's just as quick",
            });
            return '';
        }
    }
    catch (e) {
        if (!isPostInstallProcess()) {
            const additionalInfo = [
                'To prevent the build from breaking we are returning the root lock file.',
            ];
            if (packageManager === 'npm') {
                additionalInfo.push('If you run `npm install --package-lock-only` in your output folder it will regenerate the correct pruned lockfile.');
            }
            if (packageManager === 'pnpm') {
                additionalInfo.push('If you run `pnpm install --lockfile-only` in your output folder it will regenerate the correct pruned lockfile.');
            }
            output_1.output.error({
                title: 'An error occured while creating pruned lockfile',
                bodyLines: errorBodyLines(e, additionalInfo),
            });
        }
        return content;
    }
}
// generate body lines for error message
function errorBodyLines(originalError, additionalInfo = []) {
    return [
        'Please open an issue at `https://github.com/nrwl/nx/issues/new?template=1-bug.yml` and provide a reproduction.',
        ...additionalInfo,
        `\nOriginal error: ${originalError.message}\n\n`,
        originalError.stack,
    ];
}
function isPostInstallProcess() {
    return (process.env.npm_command === 'install' &&
        process.env.npm_lifecycle_event === 'postinstall');
}
