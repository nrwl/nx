"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addNxToMonorepo = addNxToMonorepo;
const enquirer_1 = require("enquirer");
const fs_1 = require("fs");
const ignore = require("ignore");
const path_1 = require("path");
const fileutils_1 = require("../../../utils/fileutils");
const output_1 = require("../../../utils/output");
const utils_1 = require("./utils");
const connect_to_nx_cloud_1 = require("../../nx-cloud/connect/connect-to-nx-cloud");
async function addNxToMonorepo(options, guided = true) {
    const repoRoot = process.cwd();
    output_1.output.log({ title: '🐳 Nx initialization' });
    const packageJsonFiles = allProjectPackageJsonFiles(repoRoot);
    const scripts = combineAllScriptNames(repoRoot, packageJsonFiles);
    let targetDefaults;
    let cacheableOperations;
    let scriptOutputs = {};
    let nxCloudChoice;
    if (options.interactive && scripts.length > 0 && guided) {
        output_1.output.log({
            title: '🧑‍🔧 Please answer the following questions about the scripts found in your workspace in order to generate task runner configuration',
        });
        targetDefaults = (await (0, enquirer_1.prompt)([
            {
                type: 'multiselect',
                name: 'targetDefaults',
                message: 'Which scripts need to be run in order? (e.g. before building a project, dependent projects must be built)',
                choices: scripts,
                /**
                 * limit is missing from the interface but it limits the amount of options shown
                 */
                limit: process.stdout.rows - 4, // 4 leaves room for the header above, the prompt and some whitespace
            },
        ])).targetDefaults;
        cacheableOperations = (await (0, enquirer_1.prompt)([
            {
                type: 'multiselect',
                name: 'cacheableOperations',
                message: 'Which scripts are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not)',
                choices: scripts,
                /**
                 * limit is missing from the interface but it limits the amount of options shown
                 */
                limit: process.stdout.rows - 4, // 4 leaves room for the header above, the prompt and some whitespace
            },
        ])).cacheableOperations;
        for (const scriptName of cacheableOperations) {
            scriptOutputs[scriptName] = (await (0, enquirer_1.prompt)([
                {
                    type: 'input',
                    name: scriptName,
                    message: `Does the "${scriptName}" script create any outputs? If not, leave blank, otherwise provide a path relative to a project root (e.g. dist, lib, build, coverage)`,
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
        targetDefaults = [];
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
    (0, utils_1.createNxJsonFile)(repoRoot, targetDefaults, cacheableOperations, scriptOutputs);
    (0, utils_1.updateGitIgnore)(repoRoot);
    (0, utils_1.addDepsToPackageJson)(repoRoot);
    output_1.output.log({ title: '📦 Installing dependencies' });
    (0, utils_1.runInstall)(repoRoot);
    if (nxCloudChoice === 'yes') {
        output_1.output.log({ title: '🛠️ Setting up Nx Cloud' });
        await (0, utils_1.initCloud)('nx-init-monorepo');
    }
    else if (nxCloudChoice === 'never') {
        (0, utils_1.setNeverConnectToCloud)(repoRoot);
    }
}
// scanning package.json files
function allProjectPackageJsonFiles(repoRoot) {
    const packageJsonFiles = allPackageJsonFiles(repoRoot, repoRoot);
    return packageJsonFiles.filter((c) => c != 'package.json');
}
function allPackageJsonFiles(repoRoot, dirName) {
    const ignoredGlobs = getIgnoredGlobs(repoRoot);
    const relDirName = (0, path_1.relative)(repoRoot, dirName);
    if (relDirName &&
        (ignoredGlobs.ignores(relDirName) ||
            relDirName.indexOf(`node_modules`) > -1)) {
        return [];
    }
    let res = [];
    try {
        (0, fs_1.readdirSync)(dirName).forEach((c) => {
            const child = (0, path_1.join)(dirName, c);
            if (ignoredGlobs.ignores((0, path_1.relative)(repoRoot, child))) {
                return;
            }
            try {
                const s = (0, fs_1.statSync)(child);
                if (s.isFile() && c == 'package.json') {
                    res.push((0, path_1.relative)(repoRoot, child));
                }
                else if (s.isDirectory()) {
                    res = [...res, ...allPackageJsonFiles(repoRoot, child)];
                }
            }
            catch { }
        });
    }
    catch { }
    return res;
}
function getIgnoredGlobs(repoRoot) {
    const ig = ignore();
    try {
        ig.add((0, fs_1.readFileSync)(`${repoRoot}/.gitignore`, 'utf-8'));
    }
    catch { }
    return ig;
}
function combineAllScriptNames(repoRoot, packageJsonFiles) {
    const res = new Set();
    packageJsonFiles.forEach((p) => {
        const packageJson = (0, fileutils_1.readJsonFile)((0, path_1.join)(repoRoot, p));
        Object.keys(packageJson.scripts || {}).forEach((scriptName) => res.add(scriptName));
    });
    return [...res];
}
