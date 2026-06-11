"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.coreNxPluginVersions = void 0;
exports.addHandler = addHandler;
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const nx_json_1 = require("../../config/nx-json");
const child_process_2 = require("../../utils/child-process");
const fileutils_1 = require("../../utils/fileutils");
const logger_1 = require("../../utils/logger");
const output_1 = require("../../utils/output");
const package_manager_1 = require("../../utils/package-manager");
const handle_errors_1 = require("../../utils/handle-errors");
const versions_1 = require("../../utils/versions");
const workspace_root_1 = require("../../utils/workspace-root");
const add_nx_scripts_1 = require("../init/implementation/dot-nx/add-nx-scripts");
const semver_1 = require("semver");
const configure_plugins_1 = require("../init/configure-plugins");
const spinner_1 = require("../../utils/spinner");
const analytics_1 = require("../../analytics");
function addHandler(options) {
    return (0, handle_errors_1.handleErrors)(options.verbose, async () => {
        output_1.output.addNewline();
        const [pkgName, version] = parsePackageSpecifier(options.packageSpecifier);
        (0, analytics_1.reportNxAddCommand)(pkgName, version);
        const nxJson = (0, nx_json_1.readNxJson)();
        await installPackage(pkgName, version, nxJson);
        await initializePlugin(pkgName, options, nxJson);
        output_1.output.success({
            title: `Package ${pkgName} added successfully.`,
        });
    });
}
async function installPackage(pkgName, version, nxJson) {
    const spinner = spinner_1.globalSpinner.start(`Installing ${pkgName}@${version}...`);
    if ((0, fs_1.existsSync)('package.json')) {
        const pm = (0, package_manager_1.detectPackageManager)();
        const pmv = (0, package_manager_1.getPackageManagerVersion)(pm);
        const pmc = (0, package_manager_1.getPackageManagerCommand)(pm);
        // if we explicitly specify latest in yarn berry, it won't resolve the version
        const command = pm === 'yarn' && (0, semver_1.gte)(pmv, '2.0.0') && version === 'latest'
            ? `${pmc.addDev} ${pkgName}`
            : `${pmc.addDev} ${pkgName}@${version}`;
        await new Promise((resolve) => (0, child_process_1.exec)(command, {
            windowsHide: true,
        }, (error, stdout, stderr) => {
            if (error) {
                spinner.fail();
                output_1.output.addNewline();
                const errorOutput = [stdout.trim(), stderr.trim()]
                    .filter(Boolean)
                    .join('\n');
                logger_1.logger.error(errorOutput);
                output_1.output.error({
                    title: `Failed to install ${pkgName}. Please check the error above for more details.`,
                });
                process.exit(1);
            }
            return resolve();
        }));
    }
    else {
        nxJson.installation.plugins ??= {};
        nxJson.installation.plugins[pkgName] = (0, add_nx_scripts_1.normalizeVersionForNxJson)(pkgName, version);
        (0, fileutils_1.writeJsonFile)('nx.json', nxJson);
        try {
            await (0, child_process_2.runNxAsync)('--help', { silent: true });
        }
        catch (e) {
            // revert adding the plugin to nx.json
            nxJson.installation.plugins[pkgName] = undefined;
            (0, fileutils_1.writeJsonFile)('nx.json', nxJson);
            spinner.fail();
            output_1.output.addNewline();
            logger_1.logger.error(e.message);
            output_1.output.error({
                title: `Failed to install ${pkgName}. Please check the error above for more details.`,
            });
            process.exit(1);
        }
    }
    spinner.succeed();
}
async function initializePlugin(pkgName, options, nxJson) {
    let updatePackageScripts = false;
    if (exports.coreNxPluginVersions.has(pkgName) &&
        (options.updatePackageScripts ||
            (options.updatePackageScripts === undefined &&
                nxJson.useInferencePlugins !== false &&
                process.env.NX_ADD_PLUGINS !== 'false'))) {
        updatePackageScripts = true;
    }
    const spinner = spinner_1.globalSpinner.start(`Initializing ${pkgName}...`);
    try {
        await (0, configure_plugins_1.runPluginInitGenerator)(pkgName, workspace_root_1.workspaceRoot, updatePackageScripts, options.verbose);
    }
    catch (e) {
        spinner.fail();
        output_1.output.addNewline();
        output_1.output.error({
            title: `Failed to initialize ${pkgName}`,
            bodyLines: (0, configure_plugins_1.getFailedToInstallPluginErrorMessages)(e),
        });
        process.exit(1);
    }
    spinner.succeed();
}
function parsePackageSpecifier(packageSpecifier) {
    const i = packageSpecifier.lastIndexOf('@');
    if (i <= 0) {
        if (exports.coreNxPluginVersions.has(packageSpecifier)) {
            return [packageSpecifier, exports.coreNxPluginVersions.get(packageSpecifier)];
        }
        return [packageSpecifier, 'latest'];
    }
    const pkgName = packageSpecifier.substring(0, i);
    const version = packageSpecifier.substring(i + 1);
    return [pkgName, version];
}
exports.coreNxPluginVersions = require(require.resolve('nx/package.json'))['nx-migrations'].packageGroup.reduce((map, entry) => {
    const packageName = typeof entry === 'string' ? entry : entry.package;
    const version = typeof entry === 'string' ? versions_1.nxVersion : entry.version;
    return map.set(packageName, version);
}, 
// Package Name -> Desired Version
new Map());
