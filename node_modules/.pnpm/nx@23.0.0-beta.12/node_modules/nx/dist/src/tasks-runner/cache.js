"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cache = exports.DbCache = void 0;
exports.dbCacheEnabled = dbCacheEnabled;
exports.getCache = getCache;
exports.resolveMaxCacheSize = resolveMaxCacheSize;
exports.parseMaxCacheSize = parseMaxCacheSize;
exports.formatCacheSize = formatCacheSize;
const child_process_1 = require("child_process");
const node_fs_1 = require("node:fs");
const promises_1 = require("node:fs/promises");
const path_1 = require("path");
const perf_hooks_1 = require("perf_hooks");
const machine_id_cache_1 = require("../utils/machine-id-cache");
const nx_json_1 = require("../config/nx-json");
const native_1 = require("../native");
const update_manager_1 = require("../nx-cloud/update-manager");
const get_cloud_options_1 = require("../nx-cloud/utilities/get-cloud-options");
const cache_directory_1 = require("../utils/cache-directory");
const db_connection_1 = require("../utils/db-connection");
const is_ci_1 = require("../utils/is-ci");
const logger_1 = require("../utils/logger");
const nx_cloud_utils_1 = require("../utils/nx-cloud-utils");
const output_1 = require("../utils/output");
const workspace_root_1 = require("../utils/workspace-root");
const default_tasks_runner_1 = require("./default-tasks-runner");
const task_io_service_1 = require("./task-io-service");
const handle_import_1 = require("../utils/handle-import");
// This function is called once during tasks runner initialization. It checks if the db cache is enabled and logs a warning if it is not.
function dbCacheEnabled() {
    // ...but if on wasm and the the db cache isnt supported we shouldn't warn
    if (native_1.IS_WASM) {
        return false;
    }
    // Below this point we are using the db cache.
    if (
    // The NX_REJECT_UNKNOWN_LOCAL_CACHE env var is not supported with the db cache.
    // If the user has tried to use it, we can point them to powerpack as it
    // provides a similar featureset.
    process.env.NX_REJECT_UNKNOWN_LOCAL_CACHE === '0' ||
        process.env.NX_REJECT_UNKNOWN_LOCAL_CACHE === 'false') {
        logger_1.logger.warn('NX_REJECT_UNKNOWN_LOCAL_CACHE=0 is not supported with the new database cache. Read more at https://nx.dev/deprecated/legacy-cache#nxrejectunknownlocalcache.');
    }
    return true;
}
// Do not change the order of these arguments as this function is used by nx cloud
function getCache(options) {
    const nxJson = (0, nx_json_1.readNxJson)();
    return dbCacheEnabled()
        ? new DbCache({
            // Remove this in Nx 21
            nxCloudRemoteCache: (0, nx_cloud_utils_1.isNxCloudUsed)(nxJson) ? options.remoteCache : null,
            skipRemoteCache: options.skipRemoteCache,
        })
        : new Cache(options);
}
class DbCache {
    constructor(options) {
        this.options = options;
        this.nxJson = (0, nx_json_1.readNxJson)();
        this.cache = new native_1.NxCache(workspace_root_1.workspaceRoot, cache_directory_1.cacheDir, (0, db_connection_1.getDbConnection)(), undefined, resolveMaxCacheSize(this.nxJson));
        this.isVerbose = process.env.NX_VERBOSE_LOGGING === 'true';
    }
    async init() {
        // This should be cheap because we've already loaded
        this.remoteCache = await this.getRemoteCache();
        if (!this.remoteCache) {
            this.assertCacheIsValid();
        }
    }
    async get(task) {
        const res = this.cache.get(task.hash);
        if (res) {
            return {
                ...res,
                terminalOutput: res.terminalOutput ?? '',
                remote: false,
            };
        }
        if (this.remoteCache) {
            // didn't find it locally but we have a remote cache
            // attempt remote cache
            const res = await this.remoteCache.retrieve(task.hash, this.cache.cacheDirectory);
            if (res) {
                this.applyRemoteCacheResults(task.hash, res, task.outputs);
                return {
                    ...res,
                    terminalOutput: res.terminalOutput ?? '',
                    remote: true,
                };
            }
            else {
                return null;
            }
        }
        else {
            return null;
        }
    }
    async getBatch(tasks) {
        const results = new Map();
        if (tasks.length === 0)
            return results;
        // Single-task fast path: direct primary-key lookup beats rarray
        // vtable overhead when there's nothing to amortize over.
        if (tasks.length === 1) {
            const res = await this.get(tasks[0]);
            if (res)
                results.set(tasks[0].hash, res);
            return results;
        }
        const hashes = tasks.map((t) => t.hash);
        // 1. Local: one rarray SQL query + parallel terminal output reads.
        //    batchResults is index-aligned with tasks, so we walk in lockstep.
        const batchResults = this.cache.getBatch(hashes);
        const remoteMisses = [];
        for (const [i, task] of tasks.entries()) {
            const res = batchResults[i];
            if (res) {
                results.set(task.hash, {
                    ...res,
                    terminalOutput: res.terminalOutput ?? '',
                    remote: false,
                });
            }
            else if (this.remoteCache) {
                remoteMisses.push(task);
            }
        }
        // 2. Remote: parallel HTTP retrievals for anything the local SQL missed.
        //    The RemoteCache interface has no batch endpoint, so this is just
        //    Promise.all over individual retrieve() calls.
        if (remoteMisses.length > 0) {
            await Promise.all(remoteMisses.map(async (task) => {
                const res = await this.remoteCache.retrieve(task.hash, this.cache.cacheDirectory);
                if (res) {
                    this.applyRemoteCacheResults(task.hash, res, task.outputs);
                    results.set(task.hash, {
                        ...res,
                        terminalOutput: res.terminalOutput ?? '',
                        remote: true,
                    });
                }
            }));
        }
        return results;
    }
    getUsedCacheSpace() {
        return this.cache.getCacheSize();
    }
    applyRemoteCacheResults(hash, res, outputs) {
        return this.cache.applyRemoteCacheResults(hash, res, outputs);
    }
    async put(task, terminalOutput, outputs, code) {
        return tryAndRetry(async () => {
            const expandedOutputs = this.cache.put(task.hash, terminalOutput, outputs, code);
            // Notify TaskIOService of actual output files
            (0, task_io_service_1.getTaskIOService)().notifyTaskOutputs(task.id, expandedOutputs);
            if (this.remoteCache) {
                await this.remoteCache.store(task.hash, this.cache.cacheDirectory, terminalOutput, code);
            }
        });
    }
    copyFilesFromCache(_, cachedResult, outputs) {
        return tryAndRetry(async () => this.cache.copyFilesFromCache(cachedResult, outputs));
    }
    removeOldCacheRecords() {
        return this.cache.removeOldCacheRecords();
    }
    temporaryOutputPath(task) {
        return this.cache.getTaskOutputsPath(task.hash);
    }
    async getRemoteCache() {
        if (this.remoteCachePromise) {
            return this.remoteCachePromise;
        }
        this.remoteCachePromise = this._getRemoteCache();
        return this.remoteCachePromise;
    }
    async _getRemoteCache() {
        if (this.options.skipRemoteCache) {
            output_1.output.warn({
                title: 'Remote Cache Disabled',
                bodyLines: [
                    'Nx will continue running, but nothing will be written or read from the remote cache.',
                ],
            });
            return null;
        }
        const nxJson = (0, nx_json_1.readNxJson)();
        if ((0, nx_cloud_utils_1.isNxCloudUsed)(nxJson)) {
            const options = (0, get_cloud_options_1.getCloudOptions)();
            try {
                const { nxCloudClient } = await (0, update_manager_1.verifyOrUpdateNxCloudClient)(options);
                if (nxCloudClient.getRemoteCache) {
                    return nxCloudClient.getRemoteCache();
                }
                else {
                    // old nx cloud instance
                    return await default_tasks_runner_1.RemoteCacheV2.fromCacheV1(this.options.nxCloudRemoteCache);
                }
            }
            catch (e) {
                if (e instanceof update_manager_1.NxCloudClientUnavailableError) {
                    output_1.output.warn({
                        title: 'No existing Nx Cloud client and failed to download new version.',
                        bodyLines: [
                            'Nx will continue running, but nothing will be written or read from the remote cache.',
                        ],
                    });
                }
                else {
                    throw e;
                }
            }
        }
        return ((await this.getS3Cache()) ??
            (await this.getSharedCache()) ??
            (await this.getGcsCache()) ??
            (await this.getAzureCache()) ??
            this.getHttpCache() ??
            null);
    }
    async getS3Cache() {
        const cache = await this.resolveRemoteCache('@nx/s3-cache');
        if (cache)
            return cache;
        return this.resolveRemoteCache('@nx/powerpack-s3-cache');
    }
    async getSharedCache() {
        const cache = await this.resolveRemoteCache('@nx/shared-fs-cache');
        if (cache)
            return cache;
        return this.resolveRemoteCache('@nx/powerpack-shared-fs-cache');
    }
    async getGcsCache() {
        const cache = await this.resolveRemoteCache('@nx/gcs-cache');
        if (cache)
            return cache;
        return this.resolveRemoteCache('@nx/powerpack-gcs-cache');
    }
    async getAzureCache() {
        const cache = await this.resolveRemoteCache('@nx/azure-cache');
        if (cache)
            return cache;
        return this.resolveRemoteCache('@nx/powerpack-azure-cache');
    }
    getHttpCache() {
        if (process.env.NX_SELF_HOSTED_REMOTE_CACHE_SERVER) {
            if (native_1.IS_WASM) {
                logger_1.logger.warn('The HTTP remote cache is not yet supported in the wasm build of Nx.');
                return null;
            }
            return new native_1.HttpRemoteCache();
        }
        return null;
    }
    async resolveRemoteCache(pkg) {
        let getRemoteCache = null;
        try {
            getRemoteCache = (await (0, handle_import_1.handleImport)(this.resolvePackage(pkg)))
                .getRemoteCache;
        }
        catch {
            return null;
        }
        return getRemoteCache();
    }
    resolvePackage(pkg) {
        return require.resolve(pkg, {
            paths: [process.cwd(), workspace_root_1.workspaceRoot, __dirname],
        });
    }
    assertCacheIsValid() {
        // User has customized the cache directory - this could be because they
        // are using a shared cache in the custom directory. The db cache is not
        // stored in the cache directory, and is keyed by machine ID so they would
        // hit issues. If we detect this, we can create a fallback db cache in the
        // custom directory, and check if the entries are there when the main db
        // cache misses.
        if ((0, is_ci_1.isCI)() && !this.cache.checkCacheFsInSync()) {
            const warningLines = [
                `Nx found unrecognized artifacts in the cache directory and will not be able to use them.`,
                `Nx can only restore artifacts it has metadata about.`,
                `Read about this warning and how to address it here: https://nx.dev/troubleshooting/unknown-local-cache`,
                ``,
            ];
            output_1.output.warn({
                title: 'Unrecognized Cache Artifacts',
                bodyLines: warningLines,
            });
        }
    }
}
exports.DbCache = DbCache;
/**
 * @deprecated Use the {@link DbCache} class instead. This will be removed in Nx 21.
 */
class Cache {
    constructor(options) {
        this.options = options;
        this.root = workspace_root_1.workspaceRoot;
        this.cachePath = this.createCacheDir();
        this.terminalOutputsDir = this.createTerminalOutputsDir();
        if (this.options.skipRemoteCache) {
            output_1.output.warn({
                title: 'Remote Cache Disabled',
                bodyLines: [
                    'Nx will continue running, but nothing will be written or read from the remote cache.',
                ],
            });
        }
    }
    removeOldCacheRecords() {
        /**
         * Even though spawning a process is fast, we don't want to do it every time
         * the user runs a command. Instead, we want to do it once in a while.
         */
        const shouldSpawnProcess = Math.floor(Math.random() * 50) === 1;
        if (shouldSpawnProcess) {
            const scriptPath = require.resolve('./remove-old-cache-records.js');
            try {
                const p = (0, child_process_1.spawn)('node', [scriptPath, `${this.cachePath}`], {
                    stdio: 'ignore',
                    detached: true,
                    shell: false,
                    windowsHide: true,
                });
                p.unref();
            }
            catch (e) {
                console.log(`Unable to start remove-old-cache-records script:`);
                console.log(e.message);
            }
        }
    }
    async get(task) {
        const res = await this.getFromLocalDir(task);
        if (res) {
            await this.assertLocalCacheValidity(task);
            return { ...res, remote: false };
        }
        else if (this.options.remoteCache && !this.options.skipRemoteCache) {
            // didn't find it locally but we have a remote cache
            // attempt remote cache
            await this.options.remoteCache.retrieve(task.hash, this.cachePath);
            // try again from local cache
            const res2 = await this.getFromLocalDir(task);
            return res2 ? { ...res2, remote: true } : null;
        }
        else {
            return null;
        }
    }
    async getBatch(tasks) {
        // Legacy file-based cache has no native batch support — loop in parallel.
        const results = new Map();
        const entries = await Promise.all(tasks.map(async (t) => ({ task: t, res: await this.get(t) })));
        for (const { task, res } of entries) {
            if (res)
                results.set(task.hash, res);
        }
        return results;
    }
    async put(task, terminalOutput, outputs, code) {
        return tryAndRetry(async () => {
            /**
             * This is the directory with the cached artifacts
             */
            const td = (0, path_1.join)(this.cachePath, task.hash);
            const tdCommit = (0, path_1.join)(this.cachePath, `${task.hash}.commit`);
            // might be left overs from partially-completed cache invocations
            await this.remove(tdCommit);
            await this.remove(td);
            await (0, promises_1.mkdir)(td, { recursive: true });
            await (0, promises_1.writeFile)((0, path_1.join)(td, 'terminalOutput'), terminalOutput ?? 'no terminal output');
            await (0, promises_1.mkdir)((0, path_1.join)(td, 'outputs'));
            const expandedOutputs = await this.expandOutputsInWorkspace(outputs);
            await Promise.all(expandedOutputs.map(async (f) => {
                const src = (0, path_1.join)(this.root, f);
                if ((0, node_fs_1.existsSync)(src)) {
                    const cached = (0, path_1.join)(td, 'outputs', f);
                    await this.copy(src, cached);
                }
            }));
            // we need this file to account for partial writes to the cache folder.
            // creating this file is atomic, whereas creating a folder is not.
            // so if the process gets terminated while we are copying stuff into cache,
            // the cache entry won't be used.
            await (0, promises_1.writeFile)((0, path_1.join)(td, 'code'), code.toString());
            await (0, promises_1.writeFile)((0, path_1.join)(td, 'source'), await (0, machine_id_cache_1.getCurrentMachineId)());
            await (0, promises_1.writeFile)(tdCommit, 'true');
            if (this.options.remoteCache && !this.options.skipRemoteCache) {
                await this.options.remoteCache.store(task.hash, this.cachePath);
            }
            if (terminalOutput) {
                const outputPath = this.temporaryOutputPath(task);
                await (0, promises_1.writeFile)(outputPath, terminalOutput);
            }
        });
    }
    async copyFilesFromCache(hash, cachedResult, outputs) {
        return tryAndRetry(async () => {
            const expandedOutputs = await this.expandOutputsInCache(outputs, cachedResult);
            await Promise.all(expandedOutputs.map(async (f) => {
                const cached = (0, path_1.join)(cachedResult.outputsPath, f);
                if ((0, node_fs_1.existsSync)(cached)) {
                    const src = (0, path_1.join)(this.root, f);
                    await this.remove(src);
                    await this.copy(cached, src);
                }
            }));
        });
    }
    temporaryOutputPath(task) {
        return (0, path_1.join)(this.terminalOutputsDir, task.hash);
    }
    async expandOutputsInWorkspace(outputs) {
        return this._expandOutputs(outputs, workspace_root_1.workspaceRoot);
    }
    async expandOutputsInCache(outputs, cachedResult) {
        return this._expandOutputs(outputs, cachedResult.outputsPath);
    }
    async _expandOutputs(outputs, cwd) {
        const { expandOutputs } = require('../native');
        perf_hooks_1.performance.mark('expandOutputs:start');
        const results = expandOutputs(cwd, outputs);
        perf_hooks_1.performance.mark('expandOutputs:end');
        perf_hooks_1.performance.measure('expandOutputs', 'expandOutputs:start', 'expandOutputs:end');
        return results;
    }
    async copy(src, destination) {
        const { copy } = require('../native');
        // 'cp -a /path/dir/ dest/' operates differently to 'cp -a /path/dir dest/'
        // --> which means actual build works but subsequent populate from cache (using cp -a) does not
        // --> the fix is to remove trailing slashes to ensure consistent & expected behaviour
        src = src.replace(/[\/\\]$/, '');
        return new Promise((res, rej) => {
            try {
                copy(src, destination);
                res();
            }
            catch (e) {
                rej(e);
            }
        });
    }
    async remove(path) {
        const { remove } = require('../native');
        return new Promise((res, rej) => {
            try {
                remove(path);
                res();
            }
            catch (e) {
                rej(e);
            }
        });
    }
    async getFromLocalDir(task) {
        const tdCommit = (0, path_1.join)(this.cachePath, `${task.hash}.commit`);
        const td = (0, path_1.join)(this.cachePath, task.hash);
        if ((0, node_fs_1.existsSync)(tdCommit)) {
            const terminalOutput = await (0, promises_1.readFile)((0, path_1.join)(td, 'terminalOutput'), 'utf-8');
            let code = 0;
            try {
                code = Number(await (0, promises_1.readFile)((0, path_1.join)(td, 'code'), 'utf-8'));
            }
            catch { }
            return {
                terminalOutput,
                outputsPath: (0, path_1.join)(td, 'outputs'),
                code,
            };
        }
        else {
            return null;
        }
    }
    async assertLocalCacheValidity(task) {
        const td = (0, path_1.join)(this.cachePath, task.hash);
        let sourceMachineId = null;
        try {
            sourceMachineId = await (0, promises_1.readFile)((0, path_1.join)(td, 'source'), 'utf-8');
        }
        catch { }
        if (sourceMachineId && sourceMachineId != (await (0, machine_id_cache_1.getCurrentMachineId)())) {
            if (process.env.NX_REJECT_UNKNOWN_LOCAL_CACHE != '0' &&
                process.env.NX_REJECT_UNKNOWN_LOCAL_CACHE != 'false') {
                const error = [
                    `Invalid Cache Directory for Task "${task.id}"`,
                    `The local cache artifact in "${td}" was not generated on this machine.`,
                    `As a result, the cache's content integrity cannot be confirmed, which may make cache restoration potentially unsafe.`,
                    `If your machine ID has changed since the artifact was cached, run "nx reset" to fix this issue.`,
                    `Read about the error and how to address it here: https://nx.dev/troubleshooting/unknown-local-cache`,
                    ``,
                ].join('\n');
                throw new Error(error);
            }
        }
    }
    createCacheDir() {
        (0, node_fs_1.mkdirSync)(cache_directory_1.cacheDir, { recursive: true });
        return cache_directory_1.cacheDir;
    }
    createTerminalOutputsDir() {
        const path = (0, path_1.join)(this.cachePath, 'terminalOutputs');
        (0, node_fs_1.mkdirSync)(path, { recursive: true });
        return path;
    }
}
exports.Cache = Cache;
function tryAndRetry(fn) {
    let attempts = 0;
    // Generate a random number between 2 and 4 to raise to the power of attempts
    const baseExponent = Math.random() * 2 + 2;
    const baseTimeout = 15;
    const _try = async () => {
        try {
            attempts++;
            return await fn();
        }
        catch (e) {
            // Max time is 15 * (4 + 4² + 4³ + 4⁴ + 4⁵) = 20460ms
            if (attempts === 6) {
                // After enough attempts, throw the error
                throw e;
            }
            await new Promise((res) => setTimeout(res, baseTimeout * baseExponent ** attempts));
            return await _try();
        }
    };
    return _try();
}
/**
 * Resolves the max cache size from environment variable or nx.json configuration
 * and converts it to a number of bytes.
 *
 * @param nxJson The nx.json configuration object
 * @returns The resolved max cache size in bytes
 */
function resolveMaxCacheSize(nxJson) {
    const rawMaxCacheSize = process.env.NX_MAX_CACHE_SIZE ?? nxJson.maxCacheSize;
    return rawMaxCacheSize !== undefined
        ? parseMaxCacheSize(rawMaxCacheSize)
        : (0, native_1.getDefaultMaxCacheSize)(cache_directory_1.cacheDir);
}
/**
 * Converts a string representation of a max cache size to a number.
 *
 * e.g. '1GB' -> 1024 * 1024 * 1024
 *      '1MB' -> 1024 * 1024
 *      '1KB' -> 1024
 *
 * @param maxCacheSize Max cache size as specified in nx.json
 */
function parseMaxCacheSize(maxCacheSize) {
    if (maxCacheSize === null || maxCacheSize === undefined) {
        return undefined;
    }
    let regexResult = maxCacheSize
        // Covers folks who accidentally specify as a number rather than a string
        .toString()
        // Match a number followed by an optional unit (KB, MB, GB), with optional whitespace between the number and unit
        .match(/^(?<size>[\d|.]+)\s?((?<unit>[KMG]?B)?)$/);
    if (!regexResult) {
        throw new Error(`Invalid max cache size specified in nx.json: ${maxCacheSize}. Must be a number followed by an optional unit (KB, MB, GB)`);
    }
    let sizeString = regexResult.groups.size;
    let unit = regexResult.groups.unit;
    if ([...sizeString].filter((c) => c === '.').length > 1) {
        throw new Error(`Invalid max cache size specified in nx.json: ${maxCacheSize} (multiple decimal points in size)`);
    }
    let size = parseFloat(sizeString);
    if (isNaN(size)) {
        throw new Error(`Invalid max cache size specified in nx.json: ${maxCacheSize} (${sizeString} is not a number)`);
    }
    switch (unit) {
        case 'KB':
            return size * 1024;
        case 'MB':
            return size * 1024 * 1024;
        case 'GB':
            return size * 1024 * 1024 * 1024;
        default:
            return size;
    }
}
function formatCacheSize(maxCacheSize, decimals = 2) {
    const exponents = ['B', 'KB', 'MB', 'GB'];
    let exponent = 0;
    let size = maxCacheSize;
    while (size >= 1024 && exponent < exponents.length - 1) {
        size /= 1024;
        exponent++;
    }
    return `${size.toFixed(decimals)} ${exponents[exponent]}`;
}
