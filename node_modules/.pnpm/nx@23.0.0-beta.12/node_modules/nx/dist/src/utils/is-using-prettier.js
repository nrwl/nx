"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isUsingPrettier = isUsingPrettier;
exports.isUsingPrettierInTree = isUsingPrettierInTree;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const json_1 = require("../generators/utils/json");
const fileutils_1 = require("./fileutils");
/**
 * Possible configuration files are taken from https://prettier.io/docs/configuration
 */
const configFiles = [
    '.prettierrc',
    '.prettierrc.json',
    '.prettierrc.yml',
    '.prettierrc.yaml',
    '.prettierrc.json5',
    '.prettierrc.js',
    'prettier.config.js',
    '.prettierrc.ts',
    'prettier.config.ts',
    '.prettierrc.mjs',
    'prettier.config.mjs',
    '.prettierrc.mts',
    'prettier.config.mts',
    '.prettierrc.cjs',
    'prettier.config.cjs',
    '.prettierrc.cts',
    'prettier.config.cts',
    '.prettierrc.toml',
];
function isUsingPrettier(root) {
    for (const file of configFiles) {
        if ((0, node_fs_1.existsSync)(file)) {
            return true;
        }
    }
    // Even if no file is present, it is possible the user is configuring prettier via their package.json
    const packageJsonPath = (0, node_path_1.join)(root, 'package.json');
    if ((0, node_fs_1.existsSync)(packageJsonPath)) {
        const packageJson = (0, fileutils_1.readJsonFile)(packageJsonPath);
        if (packageJson.prettier) {
            return true;
        }
    }
    return false;
}
function isUsingPrettierInTree(tree) {
    for (const file of configFiles) {
        if (tree.exists(file)) {
            return true;
        }
    }
    // Even if no file is present, it is possible the user is configuring prettier via their package.json
    if (tree.exists('package.json')) {
        const packageJson = (0, json_1.readJson)(tree, 'package.json');
        if (packageJson.prettier) {
            return true;
        }
    }
    return false;
}
