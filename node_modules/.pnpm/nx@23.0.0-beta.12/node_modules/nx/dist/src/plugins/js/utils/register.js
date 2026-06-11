"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerTsProject = registerTsProject;
exports.getSwcTranspiler = getSwcTranspiler;
exports.getTsNodeTranspiler = getTsNodeTranspiler;
exports.getTranspiler = getTranspiler;
exports.registerTranspiler = registerTranspiler;
exports.registerTsConfigPaths = registerTsConfigPaths;
exports.getTsNodeCompilerOptions = getTsNodeCompilerOptions;
const path_1 = require("path");
const fs_1 = require("fs");
const logger_1 = require("../../../utils/logger");
const workspace_root_1 = require("../../../utils/workspace-root");
const typescript_1 = require("./typescript");
const swcNodeInstalled = packageIsInstalled('@swc-node/register');
const tsNodeInstalled = packageIsInstalled('ts-node/register');
let ts;
let isTsEsmLoaderRegistered = false;
/**
 * tsx is a utility to run TypeScript files in node which is growing in popularity:
 * https://tsx.is
 *
 * Behind the scenes it is invoking node with relevant --require and --import flags.
 *
 * If the user is invoking Nx via a script which is being invoked via tsx, then we
 * do not need to register any transpiler at all as the environment will have already
 * been configured by tsx. In fact, registering a transpiler such as ts-node or swc
 * in this case causes issues.
 *
 * Because node is being invoked by tsx, the tsx binary does not end up in the final
 * process.argv and so we need to check a few possible things to account for usage
 * via different package managers (e.g. pnpm does not set process._ to tsx, but rather
 * pnpm itself, modern yarn does not set process._ at all etc.).
 */
const isInvokedByTsx = (() => {
    if (process.env._?.endsWith(`${path_1.sep}tsx`)) {
        return true;
    }
    const requireArgs = [];
    const importArgs = [];
    (process.execArgv ?? []).forEach((arg, i) => {
        if (arg === '-r' || arg === '--require') {
            requireArgs.push(process.execArgv[i + 1]);
        }
        if (arg === '--import') {
            importArgs.push(process.execArgv[i + 1]);
        }
    });
    const isTsxPath = (p) => p.includes(`${path_1.sep}tsx${path_1.sep}`);
    return (requireArgs.some((a) => isTsxPath(a)) ||
        importArgs.some((a) => isTsxPath(a)));
})();
/**
 * Whether the current Node.js version supports native TypeScript execution
 * via type stripping (Node 22.6+).
 *
 * process.features.typescript is 'strip' | 'transform' | false in Node 22.6+
 */
const nodeSupportsNativeTypescript = !!process.features
    ?.typescript;
/**
 * When process.features.typescript is truthy and the user has opted in via
 * NX_PREFER_NODE_STRIP_TYPES=true, we can skip registering swc-node or ts-node
 * transpilers since Node.js will handle TypeScript natively.
 *
 * This can significantly improve performance when loading TypeScript config files, but there are some things
 * that won't work. See: https://nodejs.org/api/typescript.html#full-typescript-support
 *
 * TODO(v23): We should turn this on by default, but look at if need to fallback to SWC/ts-node if it fails.
 */
const preferNodeStripTypes = (() => {
    if (process.env.NX_PREFER_NODE_STRIP_TYPES !== 'true') {
        return false;
    }
    return nodeSupportsNativeTypescript;
})();
function registerTsProject(path, configFilename) {
    // See explanation alongside isInvokedByTsx declaration
    if (isInvokedByTsx) {
        return () => { };
    }
    const tsConfigPath = configFilename ? (0, path_1.join)(path, configFilename) : path;
    // See explanation alongside preferNodeStripTypes declaration
    // When using Node.js native type stripping, skip transpiler registration
    // but still register tsconfig-paths for path mapping support
    if (preferNodeStripTypes) {
        return registerTsConfigPaths(tsConfigPath);
    }
    const { compilerOptions, tsConfigRaw } = readCompilerOptions(tsConfigPath);
    const cleanupFunctions = [
        registerTsConfigPaths(tsConfigPath),
        registerTranspiler(compilerOptions, tsConfigRaw),
    ];
    // Add ESM support for `.ts` files.
    // NOTE: There is no cleanup function for this, as it's not possible to unregister the loader.
    //       Based on limited testing, it doesn't seem to matter if we register it multiple times, but just in
    //       case let's keep a flag to prevent it.
    if (!isTsEsmLoaderRegistered) {
        // We need a way to ensure that `.ts` files are treated as ESM not CJS.
        // Since there is no way to pass compilerOptions like we do with the programmatic API, we should default
        // the environment variable that ts-node checks.
        process.env.TS_NODE_COMPILER_OPTIONS ??= JSON.stringify({
            moduleResolution: 'nodenext',
            module: 'nodenext',
        });
        const module = require('node:module');
        if (module.register && packageIsInstalled('ts-node/esm')) {
            const url = require('node:url');
            module.register(url.pathToFileURL(require.resolve('ts-node/esm')));
        }
        isTsEsmLoaderRegistered = true;
    }
    return () => {
        for (const fn of cleanupFunctions) {
            fn();
        }
    };
}
function getSwcTranspiler(compilerOptions) {
    // These are requires to prevent it from registering when it shouldn't
    const register = require('@swc-node/register/register')
        .register;
    const cleanupFn = register({
        ...compilerOptions,
        baseUrl: compilerOptions.baseUrl ?? './',
    });
    return typeof cleanupFn === 'function' ? cleanupFn : () => { };
}
function getTsNodeTranspiler(compilerOptions, tsNodeOptions, preferTsNode) {
    const { register } = require('ts-node');
    // ts-node doesn't provide a cleanup method
    const service = register({
        ...tsNodeOptions,
        transpileOnly: true,
        compilerOptions: getTsNodeCompilerOptions({
            ...tsNodeOptions?.compilerOptions,
            ...compilerOptions,
        }),
        // we already read and provide the compiler options, so prevent ts-node from reading them again
        skipProject: true,
    });
    const { transpiler, swc } = service.options;
    // Don't warn if a faster transpiler is enabled
    if (!transpiler && !swc && !preferTsNode) {
        warnTsNodeUsage();
    }
    return () => {
        // Do not cleanup ts-node service since other consumers may need it
    };
}
/**
 * Given the raw "ts-node" sub-object from a tsconfig, return an object with only the properties
 * recognized by "ts-node"
 *
 * Adapted from the function of the same name in ts-node
 */
function filterRecognizedTsConfigTsNodeOptions(jsonObject) {
    if (typeof jsonObject !== 'object' || jsonObject === null) {
        return { recognized: {}, unrecognized: {} };
    }
    const { compiler, compilerHost, compilerOptions, emit, files, ignore, ignoreDiagnostics, logError, preferTsExts, pretty, require, skipIgnore, transpileOnly, typeCheck, transpiler, scope, scopeDir, moduleTypes, experimentalReplAwait, swc, experimentalResolver, esm, experimentalSpecifierResolution, experimentalTsImportSpecifiers, ...unrecognized } = jsonObject;
    const filteredTsConfigOptions = {
        compiler,
        compilerHost,
        compilerOptions,
        emit,
        experimentalReplAwait,
        files,
        ignore,
        ignoreDiagnostics,
        logError,
        preferTsExts,
        pretty,
        require,
        skipIgnore,
        transpileOnly,
        typeCheck,
        transpiler,
        scope,
        scopeDir,
        moduleTypes,
        swc,
        experimentalResolver,
        esm,
        experimentalSpecifierResolution,
        experimentalTsImportSpecifiers,
    };
    // Use the typechecker to make sure this implementation has the correct set of properties
    const catchExtraneousProps = null;
    const catchMissingProps = null;
    return { recognized: filteredTsConfigOptions, unrecognized };
}
const registered = new Map();
function getTranspiler(compilerOptions, tsConfigRaw) {
    const preferTsNode = process.env.NX_PREFER_TS_NODE === 'true';
    if (!ts) {
        ts = require('typescript');
    }
    compilerOptions.lib = ['es2021'];
    compilerOptions.module = ts.ModuleKind.CommonJS;
    // use NodeJs module resolution until support for TS 4.x is dropped and then
    // we can switch to Node10
    compilerOptions.moduleResolution = ts.ModuleResolutionKind.NodeJs;
    compilerOptions.customConditions = null;
    compilerOptions.target = ts.ScriptTarget.ES2021;
    compilerOptions.inlineSourceMap = true;
    compilerOptions.skipLibCheck = true;
    // These options are different per project, and since they are not needed for transpilation, we can remove them so we have more cache hits.
    compilerOptions.outDir = undefined;
    compilerOptions.outFile = undefined;
    compilerOptions.declaration = undefined;
    compilerOptions.declarationMap = undefined;
    compilerOptions.composite = undefined;
    compilerOptions.tsBuildInfoFile = undefined;
    delete compilerOptions.strict;
    let _getTranspiler;
    let registrationKey = JSON.stringify(compilerOptions);
    let tsNodeOptions;
    if (swcNodeInstalled && !preferTsNode) {
        _getTranspiler = getSwcTranspiler;
    }
    else if (tsNodeInstalled) {
        // We can fall back on ts-node if it's available
        _getTranspiler = getTsNodeTranspiler;
        tsNodeOptions = filterRecognizedTsConfigTsNodeOptions(tsConfigRaw?.['ts-node']).recognized;
        // include ts-node options in the registration key
        registrationKey += JSON.stringify(tsNodeOptions);
    }
    else {
        _getTranspiler = undefined;
    }
    // Just return if transpiler was already registered before.
    const registrationEntry = registered.get(registrationKey);
    if (registered.has(registrationKey)) {
        registrationEntry.refCount++;
        return registrationEntry.cleanup;
    }
    if (_getTranspiler) {
        const transpilerCleanup = _getTranspiler(compilerOptions, tsNodeOptions, preferTsNode);
        const currRegistrationEntry = {
            refCount: 1,
            cleanup: () => {
                return () => {
                    currRegistrationEntry.refCount--;
                    if (currRegistrationEntry.refCount === 0) {
                        registered.delete(registrationKey);
                        transpilerCleanup();
                    }
                };
            },
        };
        registered.set(registrationKey, currRegistrationEntry);
        return currRegistrationEntry.cleanup;
    }
}
/**
 * Register ts-node or swc-node given a set of compiler options.
 *
 * Note: Several options require enums from typescript. To avoid importing typescript,
 * use import type + raw values
 *
 * @returns cleanup method
 */
function registerTranspiler(compilerOptions, tsConfigRaw) {
    // Function to register transpiler that returns cleanup function
    const transpiler = getTranspiler(compilerOptions, tsConfigRaw);
    if (!transpiler) {
        // If Node.js natively supports TypeScript (22.6+), no transpiler is needed.
        // Don't warn — Node will handle .ts files via type stripping.
        if (!nodeSupportsNativeTypescript) {
            warnNoTranspiler();
        }
        return () => { };
    }
    return transpiler();
}
/**
 * @param tsConfigPath Adds the paths from a tsconfig file into node resolutions
 * @returns cleanup function
 */
function registerTsConfigPaths(tsConfigPath) {
    try {
        /**
         * Load the ts config from the source project
         */
        const tsconfigPaths = loadTsConfigPaths();
        const tsConfigResult = tsconfigPaths.loadConfig(tsConfigPath);
        /**
         * Register the custom workspace path mappings with node so that workspace libraries
         * can be imported and used within project
         */
        if (tsConfigResult.resultType === 'success') {
            return tsconfigPaths.register({
                baseUrl: resolvePathsBaseUrl(tsConfigPath),
                paths: tsConfigResult.paths,
            });
        }
    }
    catch (err) {
        if (err instanceof Error) {
            throw new Error(`Unable to load ${tsConfigPath}: ` + err.message);
        }
    }
    throw new Error(`Unable to load ${tsConfigPath}`);
}
function readCompilerOptions(tsConfigPath) {
    const preferTsNode = process.env.NX_PREFER_TS_NODE === 'true';
    if (swcNodeInstalled && !preferTsNode) {
        return {
            compilerOptions: readCompilerOptionsWithSwc(tsConfigPath),
        };
    }
    else {
        return readCompilerOptionsWithTypescript(tsConfigPath);
    }
}
function readCompilerOptionsWithSwc(tsConfigPath) {
    const { readDefaultTsConfig, } = require('@swc-node/register/read-default-tsconfig');
    const compilerOptions = readDefaultTsConfig(tsConfigPath);
    // This is returned in compiler options for some reason, but not part of the typings.
    // @swc-node/register filters the files to transpile based on it, but it can be limiting when processing
    // files not part of the received tsconfig included files (e.g. shared helpers, or config files not in source, etc.).
    delete compilerOptions.files;
    // @swc-node/register's readDefaultTsConfig auto-sets baseUrl to the
    // dirname of the tsconfig when not explicitly configured. This is incorrect
    // when paths are inherited via "extends" from a parent tsconfig at a
    // different directory level (e.g., tsconfig.base.json at workspace root),
    // because SWC will resolve "./"-prefixed paths relative to the wrong
    // directory. Use the workspace root as baseUrl in that case.
    // baseUrl will not be configured when using newer versions of TypeScript like `tsgo`.
    if (compilerOptions.paths) {
        const { options: tsOptions } = (0, typescript_1.readTsConfigWithoutFiles)(tsConfigPath);
        if (!tsOptions.baseUrl) {
            compilerOptions.baseUrl = workspace_root_1.workspaceRoot;
        }
    }
    return compilerOptions;
}
function readCompilerOptionsWithTypescript(tsConfigPath) {
    const { options, raw } = (0, typescript_1.readTsConfigWithoutFiles)(tsConfigPath);
    // This property is returned in compiler options for some reason, but not part of the typings.
    // ts-node fails on unknown props, so we have to remove it.
    delete options.configFilePath;
    return {
        compilerOptions: options,
        tsConfigRaw: raw,
    };
}
function loadTsConfigPaths() {
    try {
        return require('tsconfig-paths');
    }
    catch {
        warnNoTsconfigPaths();
    }
}
function warnTsNodeUsage() {
    logger_1.logger.warn((0, logger_1.stripIndent)(`${logger_1.NX_PREFIX} Falling back to ts-node for local typescript execution. This may be a little slower.
  - To fix this, ensure @swc-node/register and @swc/core have been installed`));
}
function warnNoTsconfigPaths() {
    logger_1.logger.warn((0, logger_1.stripIndent)(`${logger_1.NX_PREFIX} Unable to load tsconfig-paths, workspace libraries may be inaccessible.
  - To fix this, install tsconfig-paths with npm/yarn/pnpm`));
}
function warnNoTranspiler() {
    logger_1.logger.warn((0, logger_1.stripIndent)(`${logger_1.NX_PREFIX} Unable to locate swc-node or ts-node. Nx will be unable to run local ts files without transpiling.
  - To fix this, ensure @swc-node/register and @swc/core have been installed`));
}
function packageIsInstalled(m) {
    try {
        const p = require.resolve(m);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * ts-node requires string values for enum based typescript options.
 * `register`'s signature just types the field as `object`, so we
 * unfortunately do not get any kind of type safety on this.
 */
function getTsNodeCompilerOptions(compilerOptions) {
    if (!ts) {
        ts = require('typescript');
    }
    const flagMap = {
        module: 'ModuleKind',
        target: 'ScriptTarget',
        moduleDetection: 'ModuleDetectionKind',
        newLine: 'NewLineKind',
        moduleResolution: 'ModuleResolutionKind',
        importsNotUsedAsValues: 'ImportsNotUsedAsValues',
    };
    const result = {
        ...compilerOptions,
    };
    for (const flag in flagMap) {
        if (compilerOptions[flag]) {
            result[flag] = ts[flagMap[flag]][compilerOptions[flag]];
        }
    }
    delete result.pathsBasePath;
    delete result.configFilePath;
    // instead of mapping to enum value we just remove it as it shouldn't ever need to be set for ts-node
    delete result.jsx;
    // lib option is in the format `lib.es2022.d.ts`, so we need to remove the leading `lib.` and trailing `.d.ts` to make it valid
    result.lib = result.lib?.map((value) => {
        return value.replace(/^lib\./, '').replace(/\.d\.ts$/, '');
    });
    if (result.moduleResolution) {
        result.moduleResolution =
            result.moduleResolution === 'NodeJs'
                ? 'node'
                : result.moduleResolution.toLowerCase();
    }
    return result;
}
function resolvePathsBaseUrl(tsconfigPath) {
    const chain = [];
    const queue = [tsconfigPath];
    while (queue.length > 0) {
        const absolute = (0, path_1.resolve)(queue.shift());
        const dir = (0, path_1.dirname)(absolute);
        try {
            const raw = JSON.parse((0, fs_1.readFileSync)(absolute, 'utf-8'));
            chain.push({ dir, raw });
            const exts = raw.extends
                ? Array.isArray(raw.extends)
                    ? raw.extends
                    : [raw.extends]
                : [];
            for (const ext of exts) {
                const resolved = resolveExtendsPath(ext, dir);
                if (resolved) {
                    queue.push(resolved);
                }
            }
        }
        catch {
            // skip unreadable files
        }
    }
    let pathsIndex = -1;
    for (let i = 0; i < chain.length; i++) {
        if (chain[i].raw.compilerOptions?.paths &&
            Object.keys(chain[i].raw.compilerOptions.paths).length > 0) {
            pathsIndex = i;
            break;
        }
    }
    const searchStart = pathsIndex >= 0 ? pathsIndex : 0;
    for (let i = searchStart; i < chain.length; i++) {
        if (chain[i].raw.compilerOptions?.baseUrl) {
            return (0, path_1.resolve)(chain[i].dir, chain[i].raw.compilerOptions.baseUrl);
        }
    }
    return pathsIndex >= 0
        ? chain[pathsIndex].dir
        : (0, path_1.dirname)((0, path_1.resolve)(tsconfigPath));
}
function resolveExtendsPath(ext, fromDir) {
    if (ext.startsWith('.') || (0, path_1.isAbsolute)(ext)) {
        let resolved = (0, path_1.resolve)(fromDir, ext);
        if ((0, fs_1.existsSync)(resolved))
            return resolved;
        if (!resolved.endsWith('.json')) {
            resolved += '.json';
            if ((0, fs_1.existsSync)(resolved))
                return resolved;
        }
        return null;
    }
    try {
        return require.resolve(ext, { paths: [fromDir] });
    }
    catch {
        try {
            return require.resolve(`${ext}/tsconfig.json`, { paths: [fromDir] });
        }
        catch {
            return null;
        }
    }
}
