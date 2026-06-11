"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allowedWorkspaceExtensions = exports.allowedProjectExtensions = void 0;
const project_graph_1 = require("../project-graph/project-graph");
const configuration_1 = require("../config/configuration");
const angular_json_1 = require("./angular-json");
const Module = require('module');
const originalRequire = Module.prototype.require;
let patched = false;
// If we pass props on a project that angular doesn't know about,
// it throws a warning that users see. We want to pass them still,
// so older plugins writtin in Ng Devkit can update these.
//
// There are some props in here (root) that angular already knows about,
// but it doesn't hurt to have them in here as well to help static analysis.
exports.allowedProjectExtensions = [
    'tags',
    'implicitDependencies',
    'configFilePath',
    '$schema',
    'generators',
    'namedInputs',
    'name',
    'files',
    'root',
    'sourceRoot',
    'projectType',
    'release',
    'includedScripts',
    'metadata',
    'owners',
    'nxCloudImplicitDependencies',
];
// If we pass props on the workspace that angular doesn't know about,
// it throws a warning that users see. We want to pass them still,
// so older plugins writtin in Ng Devkit can update these.
//
// There are some props in here (root) that angular already knows about,
// but it doesn't hurt to have them in here as well to help static analysis.
exports.allowedWorkspaceExtensions = [
    '$schema',
    'implicitDependencies',
    'affected',
    'defaultBase',
    'tasksRunnerOptions',
    'workspaceLayout',
    'plugins',
    'targetDefaults',
    'files',
    'generators',
    'namedInputs',
    'extends',
    'cli',
    'pluginsConfig',
    'defaultProject',
    'installation',
    'release',
    'nxCloudAccessToken',
    'nxCloudId',
    'nxCloudUrl',
    'nxCloudEncryptionKey',
    'parallel',
    'cacheDirectory',
    'useDaemonProcess',
    'useInferencePlugins',
    'neverConnectToCloud',
    'analytics',
    'sync',
    'useLegacyCache',
    'maxCacheSize',
    'tui',
    'owners',
];
if (!patched) {
    Module.prototype.require = function () {
        const result = originalRequire.apply(this, arguments);
        if (arguments[0].startsWith('@angular-devkit/core')) {
            const ngCoreWorkspace = originalRequire.apply(this, [
                `@angular-devkit/core/src/workspace/core`,
            ]);
            mockReadWorkspace(ngCoreWorkspace);
            const readJsonUtils = originalRequire.apply(this, [
                `@angular-devkit/core/src/workspace/json/reader`,
            ]);
            mockReadJsonWorkspace(readJsonUtils);
        }
        return result;
    };
    try {
        require('@angular-devkit/build-angular/src/utils/version').Version.assertCompatibleAngularVersion =
            () => { };
    }
    catch (e) { }
    try {
        require('@angular-devkit/build-angular/src/utils/version').assertCompatibleAngularVersion =
            () => { };
    }
    catch (e) { }
    try {
        require('@angular/build/private').assertCompatibleAngularVersion = () => { };
    }
    catch (e) { }
    patched = true;
}
function mockReadWorkspace(ngCoreWorkspace) {
    mockMember(ngCoreWorkspace, 'readWorkspace', (originalReadWorkspace) => (path, ...rest) => {
        path = 'angular.json';
        return originalReadWorkspace.apply(this, [path, ...rest]);
    });
}
/**
 * Patch readJsonWorkspace to handle workspaces without a central workspace file.
 * NOTE: We hide warnings that would be logged during this process.
 */
function mockReadJsonWorkspace(readJsonUtils) {
    mockMember(readJsonUtils, 'readJsonWorkspace', (originalReadJsonWorkspace) => async (path, host, options) => {
        const modifiedOptions = {
            ...options,
            allowedProjectExtensions: exports.allowedProjectExtensions,
            allowedWorkspaceExtensions: exports.allowedWorkspaceExtensions,
        };
        try {
            // Attempt angular CLI default behaviour
            return await originalReadJsonWorkspace(path, host, modifiedOptions);
        }
        catch {
            // This failed. Its most likely due to a lack of a workspace definition file,
            // or other things that are different between NgCLI and Nx config files.
            const projectGraph = await (0, project_graph_1.createProjectGraphAsync)();
            const nxJson = (0, configuration_1.readNxJson)();
            // Construct old workspace.json format from project graph
            const w = {
                ...nxJson,
                ...(0, project_graph_1.readProjectsConfigurationFromProjectGraph)(projectGraph),
            };
            // Read our v1 workspace schema
            const workspaceConfiguration = (0, angular_json_1.toOldFormat)(w);
            // readJsonWorkspace actually has AST parsing + more, so we
            // still need to call it rather than just return our file
            return originalReadJsonWorkspace.apply(this, [
                'angular.json', // path name, doesn't matter
                {
                    // second arg is a host, only method used is readFile
                    readFile: () => JSON.stringify(workspaceConfiguration),
                },
                modifiedOptions,
            ]);
        }
    });
}
function mockMember(obj, method, factory) {
    obj[method] = factory(obj[method]);
}
