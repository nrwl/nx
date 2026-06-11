"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsPluginConfig = jsPluginConfig;
const node_path_1 = require("node:path");
const fileutils_1 = require("../../../utils/fileutils");
const workspace_root_1 = require("../../../utils/workspace-root");
const fs_1 = require("fs");
function jsPluginConfig(nxJson) {
    const nxJsonConfig = nxJson?.pluginsConfig?.['@nx/js'];
    // using lerna _before_ installing deps is causing an issue when parsing lockfile.
    // See: https://github.com/lerna/lerna/issues/3807
    // Note that previous attempt to fix this caused issues with Nx itself, thus we're checking
    // for Lerna explicitly.
    // See: https://github.com/nrwl/nx/pull/18784/commits/5416138e1ddc1945d5b289672dfb468e8c544e14
    const analyzeLockfile = !(0, fs_1.existsSync)((0, node_path_1.join)(workspace_root_1.workspaceRoot, 'lerna.json')) ||
        (0, fs_1.existsSync)((0, node_path_1.join)(workspace_root_1.workspaceRoot, 'nx.json'));
    if (nxJsonConfig) {
        return {
            analyzePackageJson: true,
            analyzeSourceFiles: true,
            analyzeLockfile,
            projectsAffectedByDependencyUpdates: 'all',
            ...nxJsonConfig,
        };
    }
    if (!(0, fileutils_1.fileExists)((0, node_path_1.join)(workspace_root_1.workspaceRoot, 'package.json'))) {
        return {
            analyzeLockfile: false,
            analyzePackageJson: false,
            analyzeSourceFiles: false,
            projectsAffectedByDependencyUpdates: 'all',
        };
    }
    const packageJson = (0, fileutils_1.readJsonFile)((0, node_path_1.join)(workspace_root_1.workspaceRoot, 'package.json'));
    const packageJsonDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
    };
    if (packageJsonDeps['@nx/workspace'] ||
        packageJsonDeps['@nx/js'] ||
        packageJsonDeps['@nx/node'] ||
        packageJsonDeps['@nx/next'] ||
        packageJsonDeps['@nx/react'] ||
        packageJsonDeps['@nx/angular'] ||
        packageJsonDeps['@nx/web']) {
        return {
            analyzePackageJson: true,
            analyzeLockfile,
            analyzeSourceFiles: true,
            projectsAffectedByDependencyUpdates: 'all',
        };
    }
    else {
        return {
            analyzePackageJson: true,
            analyzeLockfile,
            analyzeSourceFiles: false,
            projectsAffectedByDependencyUpdates: 'all',
        };
    }
}
