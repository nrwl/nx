"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nxSourceMaps = exports.nxFileMap = exports.nxProjectGraph = void 0;
exports.ensureCacheDirectory = ensureCacheDirectory;
exports.readFileMapCache = readFileMapCache;
exports.readProjectGraphCache = readProjectGraphCache;
exports.readSourceMapsCache = readSourceMapsCache;
exports.createProjectFileMapCache = createProjectFileMapCache;
exports.writeCache = writeCache;
exports.writeCacheIfStale = writeCacheIfStale;
exports.shouldRecomputeWholeGraph = shouldRecomputeWholeGraph;
exports.extractCachedFileData = extractCachedFileData;
const node_fs_1 = require("node:fs");
const path_1 = require("path");
const perf_hooks_1 = require("perf_hooks");
const is_on_daemon_1 = require("../daemon/is-on-daemon");
const logger_1 = require("../daemon/logger");
const cache_directory_1 = require("../utils/cache-directory");
const fileutils_1 = require("../utils/fileutils");
const logger_2 = require("../utils/logger");
const versions_1 = require("../utils/versions");
const error_types_1 = require("./error-types");
exports.nxProjectGraph = (0, path_1.join)(cache_directory_1.workspaceDataDirectory, 'project-graph.json');
exports.nxFileMap = (0, path_1.join)(cache_directory_1.workspaceDataDirectory, 'file-map.json');
exports.nxSourceMaps = (0, path_1.join)(cache_directory_1.workspaceDataDirectory, 'source-maps.json');
function ensureCacheDirectory() {
    try {
        if (!(0, node_fs_1.existsSync)(cache_directory_1.workspaceDataDirectory)) {
            (0, node_fs_1.mkdirSync)(cache_directory_1.workspaceDataDirectory, { recursive: true });
        }
    }
    catch (e) {
        /*
         * @jeffbcross: Node JS docs recommend against checking for existence of directory immediately before creating it.
         * Instead, just try to create the directory and handle the error.
         *
         * We ran into race conditions when running scripts concurrently, where multiple scripts were
         * arriving here simultaneously, checking for directory existence, then trying to create the directory simultaneously.
         *
         * In this case, we're creating the directory. If the operation failed, we ensure that the directory
         * exists before continuing (or raise an exception).
         */
        if (!(0, fileutils_1.directoryExists)(cache_directory_1.workspaceDataDirectory)) {
            throw new Error(`Failed to create directory: ${cache_directory_1.workspaceDataDirectory}`);
        }
    }
}
function readFileMapCache() {
    perf_hooks_1.performance.mark('read cache:start');
    ensureCacheDirectory();
    let data = null;
    try {
        if ((0, fileutils_1.fileExists)(exports.nxFileMap)) {
            data = (0, fileutils_1.readJsonFile)(exports.nxFileMap);
        }
    }
    catch (error) {
        console.log(`Error reading '${exports.nxFileMap}'. Continue the process without the cache.`);
        console.log(error);
    }
    perf_hooks_1.performance.mark('read cache:end');
    perf_hooks_1.performance.measure('read cache', 'read cache:start', 'read cache:end');
    return data ?? null;
}
function readProjectGraphCache(minimumComputedAt) {
    perf_hooks_1.performance.mark('read project-graph:start');
    ensureCacheDirectory();
    try {
        if ((0, fileutils_1.fileExists)(exports.nxProjectGraph)) {
            const { computedAt, errors, ...projectGraphCache } = (0, fileutils_1.readJsonFile)(exports.nxProjectGraph);
            if (minimumComputedAt &&
                (!computedAt || computedAt < minimumComputedAt)) {
                throw new error_types_1.StaleProjectGraphCacheError();
            }
            if (errors && errors.length > 0) {
                if (!minimumComputedAt) {
                    // If you didn't pass minimum computed at, we do not know if
                    // the errors on the cached graph would be relevant to what you
                    // are running. Prior to adding error handling here, the graph
                    // would not have been written to the cache. As such, this matches
                    // existing behavior of the public API.
                    return null;
                }
                throw new error_types_1.ProjectGraphError(errors, projectGraphCache, readSourceMapsCache());
            }
            return projectGraphCache;
        }
        else {
            return null;
        }
    }
    catch (error) {
        if (error instanceof error_types_1.StaleProjectGraphCacheError ||
            error instanceof error_types_1.ProjectGraphError) {
            throw error;
        }
        console.log(`Error reading '${exports.nxProjectGraph}'. Continue the process without the cache.`);
        console.log(error);
        return null;
    }
    finally {
        perf_hooks_1.performance.mark('read project-graph:end');
        perf_hooks_1.performance.measure('read cache', 'read project-graph:start', 'read project-graph:end');
    }
}
function readSourceMapsCache() {
    perf_hooks_1.performance.mark('read source-maps:start');
    ensureCacheDirectory();
    let data = null;
    try {
        if ((0, fileutils_1.fileExists)(exports.nxSourceMaps)) {
            data = (0, fileutils_1.readJsonFile)(exports.nxSourceMaps);
        }
    }
    catch (error) {
        console.log(`Error reading '${exports.nxSourceMaps}'. Continue the process without the cache.`);
        console.log(error);
    }
    perf_hooks_1.performance.mark('read source-maps:end');
    perf_hooks_1.performance.measure('read cache', 'read source-maps:start', 'read source-maps:end');
    return data ?? null;
}
function createProjectFileMapCache(nxJson, packageJsonDeps, fileMap, tsConfig, externalNodesHash) {
    const nxJsonPlugins = getNxJsonPluginsData(nxJson, packageJsonDeps);
    const newValue = {
        version: '6.0',
        nxVersion: versions_1.nxVersion,
        // compilerOptions may not exist, especially for package-based repos
        pathMappings: tsConfig?.compilerOptions?.paths || {},
        nxJsonPlugins,
        pluginsConfig: nxJson?.pluginsConfig,
        fileMap,
        externalNodesHash,
    };
    return newValue;
}
/**
 * Tracks the mtime of the project graph cache file after the last successful
 * writeCache() call. Used by writeCacheIfStale() to skip redundant writes
 * when no external process has modified the cache file since the last write.
 */
let lastWrittenCacheMtimeMs;
function writeCache(cache, projectGraph, sourceMaps, errors) {
    perf_hooks_1.performance.mark('write cache:start');
    let retry = 1;
    let done = false;
    do {
        // write first to a unique temporary filename and then do a
        // rename of the file to the correct filename
        // this is to avoid any problems with half-written files
        // in case of crash and/or partially written files due
        // to multiple parallel processes reading and writing this file
        const unique = (Math.random().toString(16) + '0000000').slice(2, 10);
        const tmpProjectGraphPath = `${exports.nxProjectGraph}~${unique}`;
        const tmpFileMapPath = `${exports.nxFileMap}~${unique}`;
        const tmpSourceMapPath = `${exports.nxSourceMaps}~${unique}`;
        try {
            (0, fileutils_1.writeJsonFile)(tmpProjectGraphPath, {
                ...projectGraph,
                errors,
                computedAt: Date.now(),
            });
            (0, node_fs_1.renameSync)(tmpProjectGraphPath, exports.nxProjectGraph);
            (0, fileutils_1.writeJsonFile)(tmpSourceMapPath, sourceMaps);
            (0, node_fs_1.renameSync)(tmpSourceMapPath, exports.nxSourceMaps);
            // only write the file map if there are no errors
            // if there were errors, the errors make the filemap invalid
            // TODO: We should be able to keep the valid part of the filemap if the errors being thrown told us which parts of the filemap were invalid
            if (errors.length === 0) {
                (0, fileutils_1.writeJsonFile)(tmpFileMapPath, cache);
                (0, node_fs_1.renameSync)(tmpFileMapPath, exports.nxFileMap);
            }
            if ((0, is_on_daemon_1.isOnDaemon)()) {
                logger_1.serverLogger.log(`Wrote project graph cache to ${exports.nxProjectGraph}${errors.length > 0 ? ' with errors' : ''}`);
            }
            try {
                lastWrittenCacheMtimeMs = (0, node_fs_1.statSync)(exports.nxProjectGraph).mtimeMs;
            }
            catch {
                lastWrittenCacheMtimeMs = undefined;
            }
            done = true;
        }
        catch (err) {
            if (err instanceof Error) {
                console.log(`ERROR (${retry}) when writing \n${err.message}\n${err.stack}`);
            }
            else {
                console.log(`ERROR  (${retry}) unknown error when writing ${exports.nxProjectGraph} and ${exports.nxFileMap}`);
            }
            ++retry;
        }
    } while (!done && retry < 5);
    if (!done) {
        logger_2.logger.warn(`Failed to write project graph cache to ${exports.nxProjectGraph} and ${exports.nxFileMap} after 5 attempts. Continuing without cache.`);
        tryRemoveFile(exports.nxProjectGraph);
        tryRemoveFile(exports.nxFileMap);
        tryRemoveFile(exports.nxSourceMaps);
    }
    perf_hooks_1.performance.mark('write cache:end');
    perf_hooks_1.performance.measure('write cache', 'write cache:start', 'write cache:end');
}
/**
 * Writes the cache only if the on-disk cache file has been modified since
 * this process last wrote it (i.e. an external process overwrote it), or
 * if this process has never written the cache.
 *
 * Use this instead of writeCache() on hot paths where the same graph may
 * be served multiple times without changing (e.g. the daemon responding
 * to repeated client requests).
 */
function writeCacheIfStale(cache, projectGraph, sourceMaps, errors) {
    if (lastWrittenCacheMtimeMs !== undefined) {
        try {
            const currentMtimeMs = (0, node_fs_1.statSync)(exports.nxProjectGraph).mtimeMs;
            if (currentMtimeMs === lastWrittenCacheMtimeMs) {
                return;
            }
        }
        catch {
            // File doesn't exist or can't be stat'd — proceed with write
        }
    }
    writeCache(cache, projectGraph, sourceMaps, errors);
}
function shouldRecomputeWholeGraph(cache, packageJsonDeps, projects, nxJson, tsConfig, externalNodesHash) {
    if (cache.version !== '6.0') {
        return true;
    }
    if (cache.nxVersion !== versions_1.nxVersion) {
        return true;
    }
    // we have a cached project that is no longer present
    const cachedNodes = Object.keys(cache.fileMap.projectFileMap);
    if (cachedNodes.some((p) => projects[p] === undefined)) {
        return true;
    }
    // a path mapping for an existing project has changed
    if (Object.keys(cache.pathMappings).some((t) => {
        const cached = cache.pathMappings && cache.pathMappings[t]
            ? JSON.stringify(cache.pathMappings[t])
            : undefined;
        const notCached = tsConfig?.compilerOptions?.paths && tsConfig?.compilerOptions?.paths[t]
            ? JSON.stringify(tsConfig.compilerOptions.paths[t])
            : undefined;
        return cached !== notCached;
    })) {
        return true;
    }
    // a new plugin has been added
    if (JSON.stringify(getNxJsonPluginsData(nxJson, packageJsonDeps)) !==
        JSON.stringify(cache.nxJsonPlugins)) {
        return true;
    }
    if (JSON.stringify(nxJson?.pluginsConfig) !==
        JSON.stringify(cache.pluginsConfig)) {
        return true;
    }
    // Check if external nodes have changed
    if (externalNodesHash !== cache.externalNodesHash) {
        return true;
    }
    return false;
}
/*
This can only be invoked when the list of projects is either the same
or new projects have been added, so every project in the cache has a corresponding
project in fileMap
*/
function extractCachedFileData(fileMap, c) {
    const filesToProcess = {
        nonProjectFiles: [],
        projectFileMap: {},
    };
    const cachedFileData = {
        nonProjectFiles: {},
        projectFileMap: {},
    };
    const currentProjects = Object.keys(fileMap.projectFileMap).filter((name) => fileMap.projectFileMap[name].length > 0);
    currentProjects.forEach((p) => {
        processProjectNode(p, c.fileMap.projectFileMap, cachedFileData.projectFileMap, filesToProcess.projectFileMap, fileMap);
    });
    processNonProjectFiles(c.fileMap.nonProjectFiles, fileMap.nonProjectFiles, filesToProcess.nonProjectFiles, cachedFileData.nonProjectFiles);
    return {
        filesToProcess,
        cachedFileData,
    };
}
function processNonProjectFiles(cachedFiles, nonProjectFiles, filesToProcess, cachedFileData) {
    const cachedHashMap = new Map(cachedFiles.map((f) => [f.file, f]));
    for (const f of nonProjectFiles) {
        const cachedFile = cachedHashMap.get(f.file);
        if (!cachedFile || cachedFile.hash !== f.hash) {
            filesToProcess.push(f);
        }
        else {
            cachedFileData[f.file] = cachedFile;
        }
    }
}
function processProjectNode(projectName, cachedFileMap, cachedFileData, filesToProcess, { projectFileMap }) {
    if (!cachedFileMap[projectName]) {
        filesToProcess[projectName] = projectFileMap[projectName];
        return;
    }
    const fileDataFromCache = {};
    for (let f of cachedFileMap[projectName]) {
        fileDataFromCache[f.file] = f;
    }
    if (!cachedFileData[projectName]) {
        cachedFileData[projectName] = {};
    }
    for (let f of projectFileMap[projectName]) {
        const fromCache = fileDataFromCache[f.file];
        if (fromCache && fromCache.hash == f.hash) {
            cachedFileData[projectName][f.file] = fromCache;
        }
        else {
            if (!filesToProcess[projectName]) {
                filesToProcess[projectName] = [];
            }
            filesToProcess[projectName].push(f);
        }
    }
}
function tryRemoveFile(path) {
    try {
        if ((0, node_fs_1.existsSync)(path)) {
            (0, node_fs_1.rmSync)(path);
        }
    }
    catch {
        // Best effort
    }
}
function getNxJsonPluginsData(nxJson, packageJsonDeps) {
    return (nxJson?.plugins || []).map((p) => {
        const [plugin, options] = typeof p === 'string' ? [p] : [p.plugin, p.options];
        return {
            name: plugin,
            version: packageJsonDeps[plugin],
            options,
        };
    });
}
