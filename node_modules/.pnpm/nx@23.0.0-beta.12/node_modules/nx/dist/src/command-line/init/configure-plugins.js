"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.installPluginPackages = installPluginPackages;
exports.runPluginInitGenerator = runPluginInitGenerator;
exports.runPluginInitGenerators = runPluginInitGenerators;
exports.configurePlugins = configurePlugins;
exports.getFailedToInstallPluginErrorMessages = getFailedToInstallPluginErrorMessages;
const picocolors_1 = require("picocolors");
const package_manager_1 = require("../../utils/package-manager");
const output_1 = require("../../utils/output");
const workspace_root_1 = require("../../utils/workspace-root");
const utils_1 = require("./implementation/utils");
const angular_json_1 = require("../../adapter/angular-json");
const error_types_1 = require("../../project-graph/error-types");
const generator_utils_1 = require("../generate/generator-utils");
const path_1 = require("path");
const fs_1 = require("fs");
const configuration_1 = require("../../config/configuration");
const versions_1 = require("../../utils/versions");
const child_process_1 = require("../../utils/child-process");
const fileutils_1 = require("../../utils/fileutils");
const spinner_1 = require("../../utils/spinner");
function installPluginPackages(repoRoot, pmc = (0, package_manager_1.getPackageManagerCommand)(), plugins) {
    if (plugins.length === 0) {
        return;
    }
    if ((0, fs_1.existsSync)((0, path_1.join)(repoRoot, 'package.json'))) {
        (0, utils_1.addDepsToPackageJson)(repoRoot, plugins);
        (0, utils_1.runInstall)(repoRoot, pmc);
    }
    else {
        const nxJson = (0, configuration_1.readNxJson)(repoRoot);
        nxJson.installation.plugins ??= {};
        for (const plugin of plugins) {
            nxJson.installation.plugins[plugin] = versions_1.nxVersion;
        }
        (0, fileutils_1.writeJsonFile)((0, path_1.join)(repoRoot, 'nx.json'), nxJson);
        try {
            (0, child_process_1.runNxSync)('--version', { stdio: 'pipe' });
        }
        catch (e) {
            if (e?.stderr)
                process.stderr.write(e.stderr);
            throw e;
        }
    }
}
/**
 * Installs a plugin by running its init generator. It will change the file system tree passed in.
 * @param plugin The name of the plugin to install
 * @param repoRoot repo root
 * @param pmc package manager commands
 * @param updatePackageScripts whether to update package scripts
 * @param verbose whether to run in verbose mode
 * @returns void
 */
async function runPluginInitGenerator(plugin, repoRoot = workspace_root_1.workspaceRoot, updatePackageScripts = false, verbose = false, pmc = (0, package_manager_1.getPackageManagerCommand)()) {
    let command = `g ${plugin}:init ${verbose ? '--verbose' : ''}`;
    try {
        const { schema } = (0, generator_utils_1.getGeneratorInformation)(plugin, 'init', workspace_root_1.workspaceRoot, {});
        if (!!schema.properties['keepExistingVersions']) {
            command += ` --keepExistingVersions`;
        }
        if (updatePackageScripts && !!schema.properties['updatePackageScripts']) {
            command += ` --updatePackageScripts`;
        }
    }
    catch {
        // init generator does not exist, so this function should noop
        if (process.env.NX_VERBOSE_LOGGING === 'true') {
            output_1.output.log({
                title: `No "init" generator found in ${plugin}. Skipping initialization.`,
            });
        }
        return;
    }
    (0, child_process_1.runNxSync)(command, {
        stdio: [0, 1, 2],
        cwd: repoRoot,
        windowsHide: true,
        packageManagerCommand: pmc,
    });
}
/**
 * Install plugins
 * Get the implementation of the plugin's init generator and run it
 * @returns a list of succeeded plugins and a map of failed plugins to errors
 */
async function runPluginInitGenerators(plugins, updatePackageScripts, pmc, repoRoot = workspace_root_1.workspaceRoot, verbose = false) {
    if (plugins.length === 0) {
        return {
            succeededPlugins: [],
            failedPlugins: {},
        };
    }
    let succeededPlugins = [];
    const failedPlugins = {};
    for (const plugin of plugins) {
        const spinner = spinner_1.globalSpinner.start('Installing plugin ' + plugin);
        try {
            await runPluginInitGenerator(plugin, repoRoot, updatePackageScripts, verbose, pmc);
            succeededPlugins.push(plugin);
            spinner.succeed('Installed plugin ' + plugin);
        }
        catch (e) {
            failedPlugins[plugin] = e;
            spinner.fail('Failed to install plugin ' + plugin);
        }
    }
    return {
        succeededPlugins,
        failedPlugins,
    };
}
/**
 * Configures plugins, installs them, and outputs the results
 * @returns a list of succeeded plugins and a map of failed plugins to errors
 */
async function configurePlugins(plugins, updatePackageScripts, pmc, repoRoot = workspace_root_1.workspaceRoot, verbose = false) {
    if (plugins.length === 0) {
        return {
            succeededPlugins: [],
            failedPlugins: {},
        };
    }
    output_1.output.log({ title: '🔨 Configuring plugins' });
    let { succeededPlugins, failedPlugins } = await runPluginInitGenerators(plugins, updatePackageScripts, pmc, repoRoot, verbose);
    if (succeededPlugins.length > 0) {
        output_1.output.success({
            title: 'Installed Plugins',
            bodyLines: succeededPlugins.map((p) => `- ${(0, picocolors_1.bold)(p)}`),
        });
    }
    if (Object.keys(failedPlugins).length > 0) {
        output_1.output.error({
            title: `Failed to install plugins`,
            bodyLines: [
                'The following plugins were not installed:',
                ...Object.keys(failedPlugins).map((p) => `- ${(0, picocolors_1.bold)(p)}`),
            ],
        });
        Object.entries(failedPlugins).forEach(([plugin, error]) => {
            output_1.output.error({
                title: `Failed to install ${plugin}`,
                bodyLines: getFailedToInstallPluginErrorMessages(error),
            });
        });
        output_1.output.error({
            title: `To install the plugins manually`,
            bodyLines: [
                'You may need to run commands to install the plugins:',
                ...Object.keys(failedPlugins).map((p) => `- ${(0, picocolors_1.bold)(pmc.exec + ' nx add ' + p)}`),
            ],
        });
    }
    return { succeededPlugins, failedPlugins };
}
function findInitGenerator(generators) {
    if (generators['init']) {
        return 'init';
    }
    const angularPluginInstalled = (0, angular_json_1.isAngularPluginInstalled)();
    if (angularPluginInstalled && generators['ng-add']) {
        return 'ng-add';
    }
    return Object.keys(generators).find((name) => generators[name].aliases?.includes('init') ||
        (angularPluginInstalled && generators[name].aliases?.includes('ng-add')));
}
function getFailedToInstallPluginErrorMessages(e) {
    const errorBodyLines = [];
    if ((0, error_types_1.isProjectConfigurationsError)(e) && e.errors.length > 0) {
        for (const error of e.errors) {
            if ((0, error_types_1.isAggregateCreateNodesError)(error)) {
                const innerErrors = error.errors;
                for (const [file, e] of innerErrors) {
                    if (file) {
                        errorBodyLines.push(`  - ${(0, picocolors_1.bold)(file)}: ${e.message}`);
                    }
                    else {
                        errorBodyLines.push(`  - ${e.message}`);
                    }
                    if (e.stack) {
                        const innerStackTrace = '    ' + e.stack.split('\n')?.join('\n    ');
                        errorBodyLines.push(innerStackTrace);
                    }
                }
            }
            else if (!(0, error_types_1.isProjectsWithNoNameError)(error)) {
                // swallow ProjectsWithNameError
                if (error.message) {
                    errorBodyLines.push(`  - ${error.message}`);
                }
                if (error.stack) {
                    const innerStackTrace = '    ' + error.stack.split('\n')?.join('\n    ');
                    errorBodyLines.push(innerStackTrace);
                }
            }
        }
    }
    else {
        if (e.message) {
            errorBodyLines.push(`  - ${e.message}`);
        }
        if (e.stack) {
            const innerStackTrace = '    ' + e.stack.split('\n')?.join('\n    ');
            errorBodyLines.push(innerStackTrace);
        }
    }
    return errorBodyLines;
}
