"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NxAngularJsonPlugin = exports.NX_ANGULAR_JSON_PLUGIN_NAME = void 0;
exports.shouldMergeAngularProjects = shouldMergeAngularProjects;
exports.isAngularPluginInstalled = isAngularPluginInstalled;
exports.toNewFormat = toNewFormat;
exports.toOldFormat = toOldFormat;
exports.renamePropertyWithStableKeys = renamePropertyWithStableKeys;
const tslib_1 = require("tslib");
const fs_1 = require("fs");
const path = tslib_1.__importStar(require("path"));
const fileutils_1 = require("../utils/fileutils");
exports.NX_ANGULAR_JSON_PLUGIN_NAME = 'nx-angular-json-plugin';
const createNodes = [
    'angular.json',
    (f, _, ctx) => [
        [
            'angular.json',
            {
                projects: readAngularJson(ctx.workspaceRoot),
            },
        ],
    ],
];
exports.NxAngularJsonPlugin = {
    name: exports.NX_ANGULAR_JSON_PLUGIN_NAME,
    createNodes,
    createNodesV2: createNodes,
};
exports.default = exports.NxAngularJsonPlugin;
function shouldMergeAngularProjects(root, includeProjectsFromAngularJson) {
    if ((0, fs_1.existsSync)(path.join(root, 'angular.json')) &&
        // Include projects from angular.json if explicitly required.
        // e.g. when invoked from `packages/devkit/src/utils/convert-nx-executor.ts`
        (includeProjectsFromAngularJson ||
            // Or if a workspace has `@nx/angular` installed then projects from `angular.json` to be considered by Nx.
            isAngularPluginInstalled())) {
        return true;
    }
    else {
        return false;
    }
}
function isAngularPluginInstalled() {
    try {
        // nx-ignore-next-line
        require.resolve('@nx/angular');
        return true;
    }
    catch {
        return false;
    }
}
function readAngularJson(angularCliWorkspaceRoot) {
    return toNewFormat((0, fileutils_1.readJsonFile)(path.join(angularCliWorkspaceRoot, 'angular.json'))).projects;
}
function toNewFormat(w) {
    if (!w.projects) {
        return w;
    }
    for (const name in w.projects ?? {}) {
        const projectConfig = w.projects[name];
        if (projectConfig.architect) {
            renamePropertyWithStableKeys(projectConfig, 'architect', 'targets');
        }
        if (projectConfig.schematics) {
            renamePropertyWithStableKeys(projectConfig, 'schematics', 'generators');
        }
        if (!projectConfig.name) {
            projectConfig.name = name;
        }
        Object.values(projectConfig.targets || {}).forEach((target) => {
            if (target.builder !== undefined) {
                renamePropertyWithStableKeys(target, 'builder', 'executor');
            }
        });
    }
    if (w.schematics) {
        renamePropertyWithStableKeys(w, 'schematics', 'generators');
    }
    if (w.version !== 2) {
        w.version = 2;
    }
    return w;
}
function toOldFormat(w) {
    if (w.projects) {
        for (const name in w.projects) {
            const projectConfig = w.projects[name];
            if (typeof projectConfig === 'string') {
                throw new Error("'project.json' files are incompatible with version 1 workspace schemas.");
            }
            if (projectConfig.targets) {
                renamePropertyWithStableKeys(projectConfig, 'targets', 'architect');
            }
            if (projectConfig.generators) {
                renamePropertyWithStableKeys(projectConfig, 'generators', 'schematics');
            }
            delete projectConfig.name;
            Object.values(projectConfig.architect || {}).forEach((target) => {
                if (target.executor !== undefined) {
                    renamePropertyWithStableKeys(target, 'executor', 'builder');
                }
            });
        }
    }
    if (w.generators) {
        renamePropertyWithStableKeys(w, 'generators', 'schematics');
    }
    if (w.version !== 1) {
        w.version = 1;
    }
    return w;
}
// we have to do it this way to preserve the order of properties
// not to screw up the formatting
function renamePropertyWithStableKeys(obj, from, to) {
    const copy = { ...obj };
    Object.keys(obj).forEach((k) => {
        delete obj[k];
    });
    Object.keys(copy).forEach((k) => {
        if (k === from) {
            obj[to] = copy[k];
        }
        else {
            obj[k] = copy[k];
        }
    });
}
