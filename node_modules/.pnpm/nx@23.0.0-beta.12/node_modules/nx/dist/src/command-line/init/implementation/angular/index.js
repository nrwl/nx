"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addNxToAngularCliRepo = addNxToAngularCliRepo;
const enquirer_1 = require("enquirer");
const path_1 = require("path");
const fileutils_1 = require("../../../../utils/fileutils");
const versions_1 = require("../../../../utils/versions");
const object_sort_1 = require("../../../../utils/object-sort");
const output_1 = require("../../../../utils/output");
const package_json_1 = require("../../../../utils/package-json");
const utils_1 = require("../utils");
const integrated_workspace_1 = require("./integrated-workspace");
const legacy_angular_versions_1 = require("./legacy-angular-versions");
const standalone_workspace_1 = require("./standalone-workspace");
const connect_to_nx_cloud_1 = require("../../../nx-cloud/connect/connect-to-nx-cloud");
const defaultCacheableOperations = [
    'build',
    'server',
    'test',
    'lint',
];
let repoRoot;
let workspaceTargets;
async function addNxToAngularCliRepo(options) {
    repoRoot = process.cwd();
    output_1.output.log({ title: '🧐 Checking versions compatibility' });
    const legacyMigrationFn = await (0, legacy_angular_versions_1.getLegacyMigrationFunctionIfApplicable)(repoRoot, options);
    if (legacyMigrationFn) {
        output_1.output.log({ title: '💽 Running migration for a legacy Angular version' });
        await legacyMigrationFn();
        process.exit(0);
    }
    output_1.output.success({
        title: '✅ The Angular version is compatible with the latest version of Nx!',
    });
    output_1.output.log({ title: '🐳 Nx initialization' });
    const cacheableOperations = !options.integrated
        ? await collectCacheableOperations(options)
        : [];
    const nxCloudChoice = options.nxCloud === true
        ? 'yes'
        : options.nxCloud === false
            ? 'skip'
            : options.interactive
                ? await (0, connect_to_nx_cloud_1.connectExistingRepoToNxCloudPrompt)()
                : 'skip';
    output_1.output.log({ title: '📦 Installing dependencies' });
    installDependencies();
    output_1.output.log({ title: '📝 Setting up workspace' });
    await setupWorkspace(cacheableOperations, options.integrated);
    if (nxCloudChoice === 'yes') {
        output_1.output.log({ title: '🛠️ Setting up Nx Cloud' });
        await (0, utils_1.initCloud)('nx-init-angular');
    }
    else if (nxCloudChoice === 'never') {
        (0, utils_1.setNeverConnectToCloud)(repoRoot);
    }
}
async function collectCacheableOperations(options) {
    let cacheableOperations;
    workspaceTargets = getWorkspaceTargets();
    const defaultCacheableTargetsInWorkspace = defaultCacheableOperations.filter((t) => workspaceTargets.includes(t));
    if (options.interactive && workspaceTargets.length > 0) {
        output_1.output.log({
            title: '🧑‍🔧 Please answer the following questions about the targets found in your angular.json in order to generate task runner configuration',
        });
        cacheableOperations = (await (0, enquirer_1.prompt)([
            {
                type: 'multiselect',
                name: 'cacheableOperations',
                initial: defaultCacheableTargetsInWorkspace,
                message: 'Which of the following targets are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not)',
                // enquirer mutates the array below, create a new one to avoid it
                choices: [...workspaceTargets],
                /**
                 * limit is missing from the interface but it limits the amount of options shown
                 */
                limit: process.stdout.rows - 4, // 4 leaves room for the header above, the prompt and some whitespace
            },
        ])).cacheableOperations;
    }
    else {
        cacheableOperations =
            options.cacheable ?? defaultCacheableTargetsInWorkspace;
    }
    return cacheableOperations;
}
function installDependencies() {
    (0, utils_1.addDepsToPackageJson)(repoRoot);
    addPluginDependencies();
    (0, utils_1.runInstall)(repoRoot);
}
function addPluginDependencies() {
    const packageJsonPath = (0, path_1.join)(repoRoot, 'package.json');
    const packageJson = (0, fileutils_1.readJsonFile)(packageJsonPath);
    packageJson.devDependencies ??= {};
    packageJson.devDependencies['@nx/angular'] = versions_1.nxVersion;
    packageJson.devDependencies['@nx/workspace'] = versions_1.nxVersion;
    const peerDepsToInstall = [
        '@angular-devkit/core',
        '@angular-devkit/schematics',
        '@schematics/angular',
    ];
    const angularCliVersion = (0, package_json_1.getDependencyVersionFromPackageJson)('@angular/cli', repoRoot, packageJson) ??
        (0, package_json_1.getDependencyVersionFromPackageJson)('@angular-devkit/build-angular', repoRoot, packageJson) ??
        (0, package_json_1.getDependencyVersionFromPackageJson)('@angular/build', repoRoot, packageJson);
    for (const dep of peerDepsToInstall) {
        if (!packageJson.devDependencies[dep] && !packageJson.dependencies?.[dep]) {
            packageJson.devDependencies[dep] = angularCliVersion;
        }
    }
    packageJson.devDependencies = (0, object_sort_1.sortObjectByKeys)(packageJson.devDependencies);
    (0, fileutils_1.writeJsonFile)(packageJsonPath, packageJson);
}
async function setupWorkspace(cacheableOperations, isIntegratedMigration) {
    (0, utils_1.updateGitIgnore)(repoRoot);
    if (isIntegratedMigration) {
        (0, integrated_workspace_1.setupIntegratedWorkspace)();
    }
    else {
        await (0, standalone_workspace_1.setupStandaloneWorkspace)(repoRoot, cacheableOperations, workspaceTargets);
    }
}
function getWorkspaceTargets() {
    const { projects } = (0, fileutils_1.readJsonFile)((0, path_1.join)(repoRoot, 'angular.json'));
    const targets = new Set();
    for (const project of Object.values(projects ?? {})) {
        for (const target of Object.keys(project.architect ?? {})) {
            targets.add(target);
        }
    }
    return Array.from(targets);
}
