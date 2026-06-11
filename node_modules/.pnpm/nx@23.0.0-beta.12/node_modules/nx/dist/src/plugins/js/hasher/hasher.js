"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashTsConfig = hashTsConfig;
const fileutils_1 = require("../../../utils/fileutils");
const typescript_1 = require("../utils/typescript");
const find_project_for_path_1 = require("../../../project-graph/utils/find-project-for-path");
function readTsConfigJson() {
    try {
        const res = (0, fileutils_1.readJsonFile)((0, typescript_1.getRootTsConfigPath)());
        res.compilerOptions.paths ??= {};
        return res;
    }
    catch {
        return {
            compilerOptions: { paths: {} },
        };
    }
}
let tsConfigJson;
function hashTsConfig(p, projectRootMappings, { selectivelyHashTsConfig }) {
    if (!tsConfigJson) {
        tsConfigJson = readTsConfigJson();
    }
    if (selectivelyHashTsConfig) {
        return removeOtherProjectsPathRecords(p, tsConfigJson, projectRootMappings);
    }
    else {
        return JSON.stringify(tsConfigJson);
    }
}
function removeOtherProjectsPathRecords(p, tsConfigJson, projectRootMapping) {
    const { paths, ...compilerOptions } = tsConfigJson.compilerOptions;
    const filteredPaths = {};
    if (!paths) {
        return '';
    }
    for (const [key, files] of Object.entries(paths)) {
        for (const filePath of files) {
            if (p.name === (0, find_project_for_path_1.findProjectForPath)(filePath, projectRootMapping)) {
                filteredPaths[key] = files;
                break;
            }
        }
    }
    return JSON.stringify({
        compilerOptions: {
            ...compilerOptions,
            paths: filteredPaths,
        },
    });
}
