"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupStandaloneWorkspace = setupStandaloneWorkspace;
const fs_1 = require("fs");
const node_path_1 = require("node:path");
const angular_json_1 = require("../../../../adapter/angular-json");
const fileutils_1 = require("../../../../utils/fileutils");
const path_1 = require("../../../../utils/path");
const utils_1 = require("../utils");
async function setupStandaloneWorkspace(repoRoot, cacheableOperations, workspaceTargets) {
    const angularJsonPath = (0, node_path_1.join)(repoRoot, 'angular.json');
    const angularJson = (0, fileutils_1.readJsonFile)(angularJsonPath);
    const workspaceCapabilities = getWorkspaceCapabilities(angularJson.projects);
    createNxJson(repoRoot, angularJson, cacheableOperations, workspaceCapabilities, workspaceTargets);
    (0, utils_1.addVsCodeRecommendedExtensions)(repoRoot, [
        'nrwl.angular-console',
        'angular.ng-template',
        workspaceCapabilities.eslintProjectConfigFile
            ? 'dbaeumer.vscode-eslint'
            : undefined,
    ].filter(Boolean));
    replaceNgWithNxInPackageJsonScripts(repoRoot);
    // convert workspace config format to standalone project configs
    // update its targets outputs and delete angular.json
    const projects = (0, angular_json_1.toNewFormat)(angularJson).projects;
    for (const [projectName, project] of Object.entries(projects ?? {})) {
        updateProjectOutputs(repoRoot, projectName, project, cacheableOperations);
        (0, fileutils_1.writeJsonFile)((0, node_path_1.join)(project.root, 'project.json'), {
            $schema: (0, path_1.normalizePath)((0, node_path_1.relative)((0, node_path_1.join)(repoRoot, project.root), (0, node_path_1.join)(repoRoot, 'node_modules/nx/schemas/project-schema.json'))),
            name: projectName,
            ...project,
            root: undefined,
        });
    }
    (0, fs_1.unlinkSync)(angularJsonPath);
}
function createNxJson(repoRoot, angularJson, cacheableOperations, { eslintProjectConfigFile, test, karmaProjectConfigFile, }, workspaceTargets) {
    (0, utils_1.createNxJsonFile)(repoRoot, [], cacheableOperations, {});
    const nxJson = (0, fileutils_1.readJsonFile)((0, node_path_1.join)(repoRoot, 'nx.json'));
    nxJson.namedInputs = {
        sharedGlobals: [],
        default: ['{projectRoot}/**/*', 'sharedGlobals'],
        production: [
            'default',
            ...(test
                ? [
                    '!{projectRoot}/tsconfig.spec.json',
                    '!{projectRoot}/**/*.spec.[jt]s',
                    karmaProjectConfigFile ? '!{projectRoot}/karma.conf.js' : undefined,
                ].filter(Boolean)
                : []),
            ...(eslintProjectConfigFile
                ? ['!{projectRoot}/.eslintrc.json', '!{projectRoot}/eslint.config.cjs']
                : []),
        ].filter(Boolean),
    };
    nxJson.targetDefaults ??= {};
    if (workspaceTargets.includes('build')) {
        nxJson.targetDefaults.build = {
            ...nxJson.targetDefaults.build,
            dependsOn: ['^build'],
            inputs: ['production', '^production'],
        };
    }
    if (workspaceTargets.includes('server')) {
        nxJson.targetDefaults.server = {
            ...nxJson.targetDefaults.server,
            inputs: ['production', '^production'],
        };
    }
    if (workspaceTargets.includes('test')) {
        const inputs = ['default', '^production'];
        if ((0, fileutils_1.fileExists)((0, node_path_1.join)(repoRoot, 'karma.conf.js'))) {
            inputs.push('{workspaceRoot}/karma.conf.js');
        }
        nxJson.targetDefaults.test = {
            ...nxJson.targetDefaults.test,
            inputs,
        };
    }
    if (workspaceTargets.includes('lint')) {
        const inputs = ['default'];
        if ((0, fileutils_1.fileExists)((0, node_path_1.join)(repoRoot, '.eslintrc.json'))) {
            inputs.push('{workspaceRoot}/.eslintrc.json');
        }
        if ((0, fileutils_1.fileExists)((0, node_path_1.join)(repoRoot, 'eslint.config.cjs'))) {
            inputs.push('{workspaceRoot}/eslint.config.cjs');
        }
        nxJson.targetDefaults.lint = {
            ...nxJson.targetDefaults.lint,
            inputs,
        };
    }
    if (workspaceTargets.includes('e2e')) {
        nxJson.targetDefaults.e2e = {
            ...nxJson.targetDefaults.e2e,
            inputs: ['default', '^production'],
        };
    }
    (0, fileutils_1.writeJsonFile)((0, node_path_1.join)(repoRoot, 'nx.json'), nxJson);
}
function updateProjectOutputs(repoRoot, projectName, project, cacheableOperations) {
    Object.entries(project.targets ?? {}).forEach(([targetName, target]) => {
        if (target.executor === '@angular/build:application' ||
            target.executor === '@angular-devkit/build-angular:application') {
            if (target.options.outputPath) {
                if (typeof target.options.outputPath === 'string') {
                    target.outputs = ['{options.outputPath}'];
                }
                else if (target.options.outputPath.base) {
                    target.outputs = ['{options.outputPath.base}'];
                }
                else if (cacheableOperations.includes(targetName)) {
                    target.cache = false;
                }
            }
            else {
                target.options.outputPath = node_path_1.posix.join('dist', projectName);
                target.outputs = ['{options.outputPath}'];
            }
        }
        else if ([
            '@angular-devkit/build-angular:browser-esbuild',
            '@angular-devkit/build-angular:browser',
            '@angular-builders/custom-webpack:browser',
            'ngx-build-plus:browser',
            '@angular-devkit/build-angular:server',
            '@angular-builders/custom-webpack:server',
            'ngx-build-plus:server',
        ].includes(target.executor)) {
            if (target.options.outputPath) {
                target.outputs = ['{options.outputPath}'];
            }
            else if (cacheableOperations.includes(targetName)) {
                target.cache = false;
            }
        }
        else if (target.executor === '@angular-eslint/builder:lint') {
            target.outputs = ['{options.outputFile}'];
        }
        else if (target.executor === '@angular-devkit/build-angular:ng-packagr' ||
            target.executor === '@angular/build:ng-packagr') {
            try {
                const ngPackagrProject = target.options.project ?? node_path_1.posix.join(project.root, 'ng-package.json');
                const ngPackageJsonPath = (0, node_path_1.join)(repoRoot, ngPackagrProject);
                const ngPackageJson = (0, fileutils_1.readJsonFile)(ngPackageJsonPath);
                const outputPath = (0, node_path_1.relative)(repoRoot, (0, node_path_1.resolve)((0, node_path_1.dirname)(ngPackageJsonPath), ngPackageJson.dest));
                target.outputs = [`{workspaceRoot}/${(0, path_1.normalizePath)(outputPath)}`];
            }
            catch { }
        }
    });
}
function getWorkspaceCapabilities(projects) {
    const capabilities = {
        eslintProjectConfigFile: false,
        test: false,
        karmaProjectConfigFile: false,
    };
    for (const project of Object.values(projects ?? {})) {
        if (!capabilities.eslintProjectConfigFile &&
            projectHasEslintConfig(project)) {
            capabilities.eslintProjectConfigFile = true;
        }
        if (!capabilities.test && projectUsesKarmaBuilder(project)) {
            capabilities.test = true;
        }
        if (!capabilities.karmaProjectConfigFile &&
            projectHasKarmaConfig(project)) {
            capabilities.karmaProjectConfigFile = true;
        }
        if (capabilities.eslintProjectConfigFile &&
            capabilities.test &&
            capabilities.karmaProjectConfigFile) {
            return capabilities;
        }
    }
    return capabilities;
}
function projectUsesKarmaBuilder(project) {
    return Object.values(project.architect ?? {}).some((target) => target.builder === '@angular/build:karma' ||
        target.builder === '@angular-devkit/build-angular:karma');
}
function projectHasKarmaConfig(project) {
    return (0, fileutils_1.fileExists)((0, node_path_1.join)(project.root, 'karma.conf.js'));
}
function projectHasEslintConfig(project) {
    return ((0, fileutils_1.fileExists)((0, node_path_1.join)(project.root, '.eslintrc.json')) ||
        (0, fileutils_1.fileExists)((0, node_path_1.join)(project.root, 'eslint.config.js')) ||
        (0, fileutils_1.fileExists)((0, node_path_1.join)(project.root, 'eslint.config.mjs')) ||
        (0, fileutils_1.fileExists)((0, node_path_1.join)(project.root, 'eslint.config.cjs')));
}
function replaceNgWithNxInPackageJsonScripts(repoRoot) {
    const packageJsonPath = (0, node_path_1.join)(repoRoot, 'package.json');
    const packageJson = (0, fileutils_1.readJsonFile)(packageJsonPath);
    packageJson.scripts ??= {};
    Object.keys(packageJson.scripts).forEach((script) => {
        packageJson.scripts[script] = packageJson.scripts[script]
            .replace(/^nx$/, 'nx')
            .replace(/^ng /, 'nx ')
            .replace(/ ng /g, ' nx ');
    });
    (0, fileutils_1.writeJsonFile)(packageJsonPath, packageJson);
}
