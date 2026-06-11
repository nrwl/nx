"use strict";
/**
 * Note to developers: STOP! These exports end up as the public API of @nx/devkit.
 * Try hard to not add to this API to reduce the surface area we need to maintain.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDaemonEnabled = exports.createProjectFileMapUsingProjectGraph = exports.cacheDir = exports.hashArray = exports.defaultTasksRunner = exports.getOutputsForTargetAndConfiguration = exports.readProjectsConfigurationFromProjectGraph = exports.readCachedProjectGraph = exports.createProjectGraphAsync = exports.reverse = exports.workspaceRoot = exports.normalizePath = exports.joinPathFragments = exports.stripIndents = exports.writeJsonFile = exports.readJsonFile = exports.stripJsonComments = exports.serializeJson = exports.parseJson = exports.updateJson = exports.writeJson = exports.readJson = exports.validateDependency = exports.DependencyType = exports.updateNxJson = exports.readNxJson = exports.globAsync = exports.glob = exports.getProjects = exports.updateProjectConfiguration = exports.removeProjectConfiguration = exports.readProjectConfiguration = exports.addProjectConfiguration = exports.runExecutor = exports.isWorkspacesEnabled = exports.getPackageManagerVersion = exports.detectPackageManager = exports.getPackageManagerCommand = exports.output = exports.logger = exports.createNodesFromFiles = exports.StaleProjectGraphCacheError = exports.AggregateCreateNodesError = exports.workspaceLayout = void 0;
var configuration_1 = require("./config/configuration");
Object.defineProperty(exports, "workspaceLayout", { enumerable: true, get: function () { return configuration_1.workspaceLayout; } });
var error_types_1 = require("./project-graph/error-types");
Object.defineProperty(exports, "AggregateCreateNodesError", { enumerable: true, get: function () { return error_types_1.AggregateCreateNodesError; } });
Object.defineProperty(exports, "StaleProjectGraphCacheError", { enumerable: true, get: function () { return error_types_1.StaleProjectGraphCacheError; } });
var plugins_1 = require("./project-graph/plugins");
Object.defineProperty(exports, "createNodesFromFiles", { enumerable: true, get: function () { return plugins_1.createNodesFromFiles; } });
/**
 * @category Logger
 */
var logger_1 = require("./utils/logger");
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logger_1.logger; } });
/**
 * @category Utils
 */
var output_1 = require("./utils/output");
Object.defineProperty(exports, "output", { enumerable: true, get: function () { return output_1.output; } });
/**
 * @category Package Manager
 */
var package_manager_1 = require("./utils/package-manager");
Object.defineProperty(exports, "getPackageManagerCommand", { enumerable: true, get: function () { return package_manager_1.getPackageManagerCommand; } });
Object.defineProperty(exports, "detectPackageManager", { enumerable: true, get: function () { return package_manager_1.detectPackageManager; } });
Object.defineProperty(exports, "getPackageManagerVersion", { enumerable: true, get: function () { return package_manager_1.getPackageManagerVersion; } });
Object.defineProperty(exports, "isWorkspacesEnabled", { enumerable: true, get: function () { return package_manager_1.isWorkspacesEnabled; } });
/**
 * @category Commands
 */
var run_1 = require("./command-line/run/run");
Object.defineProperty(exports, "runExecutor", { enumerable: true, get: function () { return run_1.runExecutor; } });
/**
 * @category Generators
 */
var project_configuration_1 = require("./generators/utils/project-configuration");
Object.defineProperty(exports, "addProjectConfiguration", { enumerable: true, get: function () { return project_configuration_1.addProjectConfiguration; } });
Object.defineProperty(exports, "readProjectConfiguration", { enumerable: true, get: function () { return project_configuration_1.readProjectConfiguration; } });
Object.defineProperty(exports, "removeProjectConfiguration", { enumerable: true, get: function () { return project_configuration_1.removeProjectConfiguration; } });
Object.defineProperty(exports, "updateProjectConfiguration", { enumerable: true, get: function () { return project_configuration_1.updateProjectConfiguration; } });
Object.defineProperty(exports, "getProjects", { enumerable: true, get: function () { return project_configuration_1.getProjects; } });
/**
 * @category Generators
 */
var glob_1 = require("./generators/utils/glob");
Object.defineProperty(exports, "glob", { enumerable: true, get: function () { return glob_1.glob; } });
Object.defineProperty(exports, "globAsync", { enumerable: true, get: function () { return glob_1.globAsync; } });
/**
 * @category Generators
 */
var project_configuration_2 = require("./generators/utils/project-configuration");
Object.defineProperty(exports, "readNxJson", { enumerable: true, get: function () { return project_configuration_2.readNxJson; } });
Object.defineProperty(exports, "updateNxJson", { enumerable: true, get: function () { return project_configuration_2.updateNxJson; } });
/**
 * @category Project Graph
 */
var project_graph_1 = require("./config/project-graph");
Object.defineProperty(exports, "DependencyType", { enumerable: true, get: function () { return project_graph_1.DependencyType; } });
/**
 * @category Project Graph
 */
var project_graph_builder_1 = require("./project-graph/project-graph-builder");
Object.defineProperty(exports, "validateDependency", { enumerable: true, get: function () { return project_graph_builder_1.validateDependency; } });
/**
 * @category Generators
 */
var json_1 = require("./generators/utils/json");
Object.defineProperty(exports, "readJson", { enumerable: true, get: function () { return json_1.readJson; } });
Object.defineProperty(exports, "writeJson", { enumerable: true, get: function () { return json_1.writeJson; } });
Object.defineProperty(exports, "updateJson", { enumerable: true, get: function () { return json_1.updateJson; } });
/**
 * @category Utils
 */
var json_2 = require("./utils/json");
Object.defineProperty(exports, "parseJson", { enumerable: true, get: function () { return json_2.parseJson; } });
Object.defineProperty(exports, "serializeJson", { enumerable: true, get: function () { return json_2.serializeJson; } });
Object.defineProperty(exports, "stripJsonComments", { enumerable: true, get: function () { return json_2.stripJsonComments; } });
/**
 * @category Utils
 */
var fileutils_1 = require("./utils/fileutils");
Object.defineProperty(exports, "readJsonFile", { enumerable: true, get: function () { return fileutils_1.readJsonFile; } });
Object.defineProperty(exports, "writeJsonFile", { enumerable: true, get: function () { return fileutils_1.writeJsonFile; } });
/**
 * @category Utils
 */
var strip_indents_1 = require("./utils/strip-indents");
Object.defineProperty(exports, "stripIndents", { enumerable: true, get: function () { return strip_indents_1.stripIndents; } });
/**
 * @category Utils
 */
var path_1 = require("./utils/path");
Object.defineProperty(exports, "joinPathFragments", { enumerable: true, get: function () { return path_1.joinPathFragments; } });
Object.defineProperty(exports, "normalizePath", { enumerable: true, get: function () { return path_1.normalizePath; } });
/**
 * @category Utils
 */
var workspace_root_1 = require("./utils/workspace-root");
Object.defineProperty(exports, "workspaceRoot", { enumerable: true, get: function () { return workspace_root_1.workspaceRoot; } });
/**
 * @category Utils
 */
var operators_1 = require("./project-graph/operators");
Object.defineProperty(exports, "reverse", { enumerable: true, get: function () { return operators_1.reverse; } });
/**
 * @category Utils
 */
var project_graph_2 = require("./project-graph/project-graph");
Object.defineProperty(exports, "createProjectGraphAsync", { enumerable: true, get: function () { return project_graph_2.createProjectGraphAsync; } });
Object.defineProperty(exports, "readCachedProjectGraph", { enumerable: true, get: function () { return project_graph_2.readCachedProjectGraph; } });
Object.defineProperty(exports, "readProjectsConfigurationFromProjectGraph", { enumerable: true, get: function () { return project_graph_2.readProjectsConfigurationFromProjectGraph; } });
/**
 * @category Utils
 */
var utils_1 = require("./tasks-runner/utils");
Object.defineProperty(exports, "getOutputsForTargetAndConfiguration", { enumerable: true, get: function () { return utils_1.getOutputsForTargetAndConfiguration; } });
/**
 * @category Utils
 */
var default_tasks_runner_1 = require("./tasks-runner/default-tasks-runner");
Object.defineProperty(exports, "defaultTasksRunner", { enumerable: true, get: function () { return default_tasks_runner_1.defaultTasksRunner; } });
var file_hasher_1 = require("./hasher/file-hasher");
Object.defineProperty(exports, "hashArray", { enumerable: true, get: function () { return file_hasher_1.hashArray; } });
/**
 * @category Utils
 */
var cache_directory_1 = require("./utils/cache-directory");
Object.defineProperty(exports, "cacheDir", { enumerable: true, get: function () { return cache_directory_1.cacheDir; } });
/**
 * @category Utils
 */
var file_map_utils_1 = require("./project-graph/file-map-utils");
Object.defineProperty(exports, "createProjectFileMapUsingProjectGraph", { enumerable: true, get: function () { return file_map_utils_1.createProjectFileMapUsingProjectGraph; } });
var client_1 = require("./daemon/client/client");
Object.defineProperty(exports, "isDaemonEnabled", { enumerable: true, get: function () { return client_1.isDaemonEnabled; } });
