"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readTsConfig = readTsConfig;
exports.readTsConfigWithoutFiles = readTsConfigWithoutFiles;
exports.readTsConfigOptions = readTsConfigOptions;
exports.resolveModuleByImport = resolveModuleByImport;
exports.getRootTsConfigFileName = getRootTsConfigFileName;
exports.getRootTsConfigPath = getRootTsConfigPath;
exports.findNodes = findNodes;
const workspace_root_1 = require("../../../utils/workspace-root");
const fs_1 = require("fs");
const path_1 = require("path");
const normalizedAppRoot = workspace_root_1.workspaceRoot.replace(/\\/g, '/');
let tsModule;
function readTsConfig(tsConfigPath, sys) {
    if (!tsModule) {
        tsModule = require('typescript');
    }
    sys ??= tsModule.sys;
    const readResult = tsModule.readConfigFile(tsConfigPath, sys.readFile);
    return tsModule.parseJsonConfigFileContent(readResult.config, sys, (0, path_1.dirname)(tsConfigPath));
}
function readTsConfigWithoutFiles(tsConfigPath) {
    if (!tsModule) {
        tsModule = require('typescript');
    }
    // We only care about options, so we don't need to scan source files, and thus
    // `readDirectory` is stubbed for performance.
    const sys = {
        ...tsModule.sys,
        readDirectory: () => [],
    };
    return readTsConfig(tsConfigPath, sys);
}
function readTsConfigOptions(tsConfigPath) {
    const { options } = readTsConfigWithoutFiles(tsConfigPath);
    return options;
}
let compilerHost;
/**
 * Find a module based on its import
 *
 * @param importExpr Import used to resolve to a module
 * @param filePath
 * @param tsConfigPath
 */
function resolveModuleByImport(importExpr, filePath, tsConfigPath) {
    compilerHost = compilerHost || getCompilerHost(tsConfigPath);
    const { options, host, moduleResolutionCache } = compilerHost;
    const { resolvedModule } = tsModule.resolveModuleName(importExpr, filePath, options, host, moduleResolutionCache);
    if (!resolvedModule) {
        return;
    }
    else {
        return resolvedModule.resolvedFileName.replace(`${normalizedAppRoot}/`, '');
    }
}
function getCompilerHost(tsConfigPath) {
    const options = readTsConfigOptions(tsConfigPath);
    const host = tsModule.createCompilerHost(options, true);
    const moduleResolutionCache = tsModule.createModuleResolutionCache(workspace_root_1.workspaceRoot, host.getCanonicalFileName);
    return { options, host, moduleResolutionCache };
}
function getRootTsConfigFileName() {
    for (const tsConfigName of ['tsconfig.base.json', 'tsconfig.json']) {
        const tsConfigPath = (0, path_1.join)(workspace_root_1.workspaceRoot, tsConfigName);
        if ((0, fs_1.existsSync)(tsConfigPath)) {
            return tsConfigName;
        }
    }
    return null;
}
function getRootTsConfigPath() {
    const tsConfigFileName = getRootTsConfigFileName();
    return tsConfigFileName ? (0, path_1.join)(workspace_root_1.workspaceRoot, tsConfigFileName) : null;
}
function findNodes(node, kind, max = Infinity) {
    if (!node || max == 0) {
        return [];
    }
    const arr = [];
    const hasMatch = Array.isArray(kind)
        ? kind.includes(node.kind)
        : node.kind === kind;
    if (hasMatch) {
        arr.push(node);
        max--;
    }
    if (max > 0) {
        for (const child of node.getChildren()) {
            findNodes(child, kind, max).forEach((node) => {
                if (max > 0) {
                    arr.push(node);
                }
                max--;
            });
            if (max <= 0) {
                break;
            }
        }
    }
    return arr;
}
