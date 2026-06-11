"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addNxToNpmRepo = addNxToNpmRepo;
const tslib_1 = require("tslib");
const enquirer = tslib_1.__importStar(require("enquirer"));
const path_1 = require("path");
const fileutils_1 = require("../../../utils/fileutils");
const output_1 = require("../../../utils/output");
const package_manager_1 = require("../../../utils/package-manager");
const utils_1 = require("./utils");
const connect_to_nx_cloud_1 = require("../../nx-cloud/connect/connect-to-nx-cloud");
async function addNxToNpmRepo(options, guided = true) {
    const repoRoot = process.cwd();
    output_1.output.log({ title: '🐳 Nx initialization' });
    let cacheableOperations;
    let scriptOutputs = {};
    let nxCloudChoice;
    const packageJson = (0, fileutils_1.readJsonFile)('package.json');
    const scripts = Object.keys(packageJson.scripts ?? {}).filter((s) => !s.startsWith('pre') && !s.startsWith('post'));
    if (options.interactive && scripts.length > 0 && guided) {
        output_1.output.log({
            title: '🧑‍🔧 Please answer the following questions about the scripts found in your package.json in order to generate task runner configuration',
        });
        cacheableOperations = (await enquirer.prompt([
            {
                type: 'multiselect',
                name: 'cacheableOperations',
                message: 'Which of the following scripts are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not). You can use spacebar to select one or more scripts.',
                choices: scripts,
                /**
                 * limit is missing from the interface but it limits the amount of options shown
                 */
                limit: process.stdout.rows - 4, // 4 leaves room for the header above, the prompt and some whitespace
            },
        ])).cacheableOperations;
        for (const scriptName of cacheableOperations) {
            scriptOutputs[scriptName] = (await enquirer.prompt([
                {
                    type: 'input',
                    name: scriptName,
                    message: `Does the "${scriptName}" script create any outputs? If not, leave blank, otherwise provide a path (e.g. dist, lib, build, coverage)`,
                },
            ]))[scriptName];
        }
        nxCloudChoice =
            options.nxCloud === true
                ? 'yes'
                : options.nxCloud === false
                    ? 'skip'
                    : await (0, connect_to_nx_cloud_1.connectExistingRepoToNxCloudPrompt)();
    }
    else {
        cacheableOperations = options.cacheable ?? [];
        nxCloudChoice =
            options.nxCloud === true
                ? 'yes'
                : options.nxCloud === false
                    ? 'skip'
                    : options.interactive
                        ? await (0, connect_to_nx_cloud_1.connectExistingRepoToNxCloudPrompt)()
                        : 'skip';
    }
    (0, utils_1.createNxJsonFile)(repoRoot, [], cacheableOperations, scriptOutputs);
    const pmc = (0, package_manager_1.getPackageManagerCommand)();
    (0, utils_1.updateGitIgnore)(repoRoot);
    (0, utils_1.addDepsToPackageJson)(repoRoot);
    if (options.legacy) {
        (0, utils_1.markRootPackageJsonAsNxProjectLegacy)(repoRoot, cacheableOperations, pmc);
    }
    else {
        (0, utils_1.markPackageJsonAsNxProject)((0, path_1.join)(repoRoot, 'package.json'));
    }
    output_1.output.log({ title: '📦 Installing dependencies' });
    (0, utils_1.runInstall)(repoRoot, pmc);
    if (nxCloudChoice === 'yes') {
        output_1.output.log({ title: '🛠️ Setting up Nx Cloud' });
        await (0, utils_1.initCloud)('nx-init-npm-repo');
    }
    else if (nxCloudChoice === 'never') {
        (0, utils_1.setNeverConnectToCloud)(repoRoot);
    }
}
