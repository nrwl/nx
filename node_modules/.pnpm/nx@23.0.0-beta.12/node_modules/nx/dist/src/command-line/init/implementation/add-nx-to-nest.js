"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addNxToNest = addNxToNest;
const tslib_1 = require("tslib");
const enquirer = tslib_1.__importStar(require("enquirer"));
const node_fs_1 = require("node:fs");
const path_1 = require("path");
const fileutils_1 = require("../../../utils/fileutils");
const output_1 = require("../../../utils/output");
const package_manager_1 = require("../../../utils/package-manager");
const utils_1 = require("./utils");
const versions_1 = require("../../../utils/versions");
const connect_to_nx_cloud_1 = require("../../nx-cloud/connect/connect-to-nx-cloud");
async function addNxToNest(options, packageJson) {
    const repoRoot = process.cwd();
    output_1.output.log({ title: '🐳 Nx initialization' });
    // we check upstream that nest-cli.json exists before it reaches this function
    // so it is guaranteed to be here
    const nestCliJson = (0, fileutils_1.readJsonFile)((0, path_1.join)(repoRoot, 'nest-cli.json'));
    const nestCLIConfiguration = mergeWithDefaultConfig(nestCliJson);
    // For NestJS CLI Monorepo, this property is always "true"
    if (nestCLIConfiguration.monorepo) {
        // TODO: update message for NestJS CLI Monorepo support
        output_1.output.log({ title: 'NestCLI Monorepo support is coming soon' });
        return;
    }
    const isJS = nestCLIConfiguration.language === 'js';
    const nestCacheableScripts = ['build', 'lint', 'test'];
    const nestIgnoreScripts = [
        'start',
        'start:dev',
        'start:debug',
        'test:cov',
        'test:watch',
    ];
    const scripts = Object.keys(packageJson.scripts ?? {}).filter((s) => {
        if (nestCacheableScripts.includes(s) || nestIgnoreScripts.includes(s)) {
            return false;
        }
        return !s.startsWith('pre') && !s.startsWith('post');
    });
    let cacheableOperations;
    let scriptOutputs = {};
    let nxCloudChoice;
    if (options.interactive && scripts.length > 0) {
        output_1.output.log({
            title: '🧑‍🔧 Please answer the following questions about the scripts found in your package.json in order to generate task runner configuration',
        });
        cacheableOperations = (await enquirer.prompt([
            {
                type: 'multiselect',
                name: 'cacheableOperations',
                message: 'Which of the following scripts are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not)',
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
    (0, utils_1.createNxJsonFile)(repoRoot, [], [...cacheableOperations, ...nestCacheableScripts], scriptOutputs);
    const pmc = (0, package_manager_1.getPackageManagerCommand)();
    (0, utils_1.updateGitIgnore)(repoRoot);
    (0, utils_1.addDepsToPackageJson)(repoRoot);
    addNestPluginToPackageJson(repoRoot);
    (0, utils_1.markRootPackageJsonAsNxProjectLegacy)(repoRoot, cacheableOperations, pmc);
    createProjectJson(repoRoot, packageJson, nestCLIConfiguration);
    removeFile(repoRoot, 'nest-cli.json');
    updatePackageJsonScripts(repoRoot, isJS);
    if (!isJS) {
        updateTsConfig(repoRoot, nestCLIConfiguration.sourceRoot);
    }
    output_1.output.log({ title: '📦 Installing dependencies' });
    (0, utils_1.runInstall)(repoRoot);
    if (nxCloudChoice === 'yes') {
        output_1.output.log({ title: '🛠️ Setting up Nx Cloud' });
        await (0, utils_1.initCloud)('nx-init-nest');
    }
    else if (nxCloudChoice === 'never') {
        (0, utils_1.setNeverConnectToCloud)(repoRoot);
    }
}
function addNestPluginToPackageJson(repoRoot) {
    const path = (0, path_1.join)(repoRoot, `package.json`);
    const json = (0, fileutils_1.readJsonFile)(path);
    json.devDependencies['@nx/nest'] = versions_1.nxVersion;
    json.devDependencies['@nx/jest'] = versions_1.nxVersion;
    (0, fileutils_1.writeJsonFile)(path, json);
}
function createProjectJson(repoRoot, packageJson, nestCLIOptions) {
    const packageName = packageJson.name;
    const path = (0, path_1.join)(repoRoot, 'project.json');
    const json = {
        name: packageName,
        root: '.',
        sourceRoot: nestCLIOptions.sourceRoot,
        projectType: 'application',
        targets: {},
        tags: [],
    };
    json['$schema'] = 'node_modules/nx/schemas/project-schema.json';
    if (nestCLIOptions.language !== 'js') {
        json.targets['serve'] = {
            executor: '@nx/js:node',
            options: {
                buildTarget: `${packageName}:build`,
            },
        };
        if (nestCLIOptions.webpackOptions) {
            json.targets['build'] = {
                executor: '@nx/webpack:webpack',
                outputs: ['{options.outputPath}'],
                options: {
                    target: 'node',
                    compiler: 'tsc',
                    outputPath: `dist/${packageName}`,
                    main: (0, path_1.join)(nestCLIOptions.sourceRoot, nestCLIOptions.entryFile),
                    tsConfig: 'tsconfig.build.json',
                },
                configurations: {
                    production: {
                        optimization: true,
                        extractLicenses: true,
                        inspect: false,
                    },
                },
            };
            json.targets['serve'] = {
                ...json.targets['serve'],
                configurations: {
                    production: {
                        buildTarget: `${packageName}:build:production`,
                    },
                },
            };
        }
        else {
            json.targets['build'] = {
                executor: '@nx/js:tsc',
                outputs: ['{options.outputPath}'],
                options: {
                    outputPath: `dist/${packageName}`,
                    main: (0, path_1.join)(nestCLIOptions.sourceRoot, nestCLIOptions.entryFile),
                    tsConfig: 'tsconfig.build.json',
                },
            };
            json.targets['serve'] = {
                ...json.targets['serve'],
                configurations: {
                    debug: {
                        inspect: 'inspect',
                    },
                },
            };
            // if we're using nrwl/js, then we add nrwl/js analyzeSourceFiles to nx.json
            addNrwlJsPluginsConfig(repoRoot);
        }
        // lint
        json.targets['lint'] = {
            executor: '@nx/eslint:lint',
            options: {
                lintFilePatterns: ['./src', './test'],
            },
        };
        // test and e2e
        addJestTargets(repoRoot, packageName, json, packageJson);
    }
    (0, fileutils_1.writeJsonFile)(path, json);
}
function getJestOptions(isE2E, repoRoot, packageName, existingOptions) {
    // try get the e2e json if we find it
    if (isE2E && !existingOptions) {
        try {
            existingOptions = (0, fileutils_1.readJsonFile)((0, path_1.join)(repoRoot, 'test/jest-e2e.json'));
            removeFile(repoRoot, 'test/jest-e2e.json');
        }
        catch (e) { }
    }
    const jestOptions = existingOptions || {
        moduleFileExtensions: ['js', 'json', 'ts'],
        testEnvironment: 'node',
        transform: { '^.+\\.(t|j)s$': 'ts-jest' },
    };
    jestOptions['displayName'] = isE2E ? `${packageName}-e2e` : packageName;
    // remove rootDir and testRegex, we'll use testMatch instead since we'll have the
    // root jest.preset.js in the root instead of 'src'
    delete jestOptions['rootDir'];
    delete jestOptions['testRegex'];
    jestOptions['testMatch'] = isE2E
        ? ['<rootDir>/test/**/?(*.)+(e2e-spec|e2e-test).[jt]s?(x)']
        : ['<rootDir>/src/**/*(*.)@(spec|test).[jt]s?(x)'];
    // set coverage directory for unit test
    if (!isE2E) {
        jestOptions['coverageDirectory'] = `./coverage/${packageName}`;
    }
    return jestOptions;
}
function tryCreateJestPreset(repoRoot) {
    const jestPresetPath = (0, path_1.join)(repoRoot, 'jest.preset.js');
    if (!(0, fileutils_1.fileExists)(jestPresetPath)) {
        (0, node_fs_1.writeFileSync)(jestPresetPath, `
const nxPreset = require('@nx/jest/preset').default;
module.exports = {...nxPreset};
`, 'utf8');
        return true;
    }
    return false;
}
function addJestTargets(repoRoot, packageName, projectJson, packageJson) {
    const unitTestOptions = getJestOptions(false, repoRoot, packageName, packageJson['jest']);
    const unitTestConfigPath = 'jest.config.ts';
    const e2eTestOptions = getJestOptions(true, repoRoot, packageName);
    const e2eTestConfigPath = 'jest.e2e-config.ts';
    const isPresetCreated = tryCreateJestPreset(repoRoot);
    if (isPresetCreated) {
        unitTestOptions['preset'] = e2eTestOptions['preset'] = './jest.preset.js';
    }
    (0, node_fs_1.writeFileSync)(unitTestConfigPath, `export default ${JSON.stringify(unitTestOptions, null, 2)}`, 'utf8');
    (0, node_fs_1.writeFileSync)(e2eTestConfigPath, `export default ${JSON.stringify(e2eTestOptions, null, 2)}`, 'utf8');
    projectJson.targets['test'] = {
        executor: '@nx/jest:jest',
        outputs: [`{workspaceRoot}/coverage/${packageName}`],
        options: {
            passWithNoTests: true,
            jestConfig: unitTestConfigPath,
        },
    };
    projectJson.targets['e2e'] = {
        executor: '@nx/jest:jest',
        options: {
            passWithNoTests: true,
            jestConfig: e2eTestConfigPath,
        },
    };
    // remove jest options from package.json
    delete packageJson['jest'];
}
function addNrwlJsPluginsConfig(repoRoot) {
    const path = (0, path_1.join)(repoRoot, 'nx.json');
    const json = (0, fileutils_1.readJsonFile)(path);
    if (!json.pluginsConfig) {
        json.pluginsConfig = {
            '@nx/js': {
                analyzeSourceFiles: true,
            },
        };
    }
    (0, fileutils_1.writeJsonFile)(path, json);
}
function updatePackageJsonScripts(repoRoot, isJS) {
    const path = (0, path_1.join)(repoRoot, `package.json`);
    const json = (0, fileutils_1.readJsonFile)(path);
    if (json.scripts['build']) {
        json.scripts['build'] = 'nx build';
    }
    if (json.scripts['lint']) {
        json.scripts['lint'] = 'nx lint';
    }
    if (json.scripts['start:debug']) {
        json.scripts['start:debug'] = 'nx serve --configuration=debug';
    }
    if (json.scripts['test']) {
        json.scripts['test'] = 'nx test';
    }
    if (json.scripts['test:cov']) {
        delete json.scripts['test:cov'];
    }
    if (json.scripts['test:watch']) {
        delete json.scripts['test:watch'];
    }
    if (json.scripts['test:e2e']) {
        delete json.scripts['test:e2e'];
        json.scripts['e2e'] = 'nx e2e';
    }
    if (!isJS) {
        if (json.scripts['start']) {
            json.scripts['start'] = 'nx serve';
        }
        if (json.scripts['start:dev']) {
            // same as nx serve
            delete json.scripts['start:dev'];
        }
    }
    (0, fileutils_1.writeJsonFile)(path, json);
}
function updateTsConfig(repoRoot, sourceRoot) {
    const path = (0, path_1.join)(repoRoot, `tsconfig.build.json`);
    const json = (0, fileutils_1.readJsonFile)(path);
    // we add include to the tsconfig.build because our executor runs tsc with
    // generated tsconfig which is in `tmp/**.generated.json`. By default, tsc
    // cannot find the default source files anymore.
    if (!json.include)
        json.include = [];
    json.include.push(`${sourceRoot}/**/*.ts`);
    (0, fileutils_1.writeJsonFile)(path, json);
}
function removeFile(repoRoot, file) {
    const path = (0, path_1.join)(repoRoot, file);
    (0, node_fs_1.unlinkSync)(path);
}
function mergeWithDefaultConfig(config) {
    const defaultNestCliConfigurations = {
        language: 'ts',
        sourceRoot: 'src',
        collection: '@nestjs/schematics',
        entryFile: 'main',
        projects: {},
        monorepo: false,
        compilerOptions: {
            tsConfigPath: 'tsconfig.build.json',
            webpack: false,
            webpackConfigPath: 'webpack.config.js',
            plugins: [],
            assets: [],
        },
        generateOptions: {},
    };
    if (config.compilerOptions) {
        return {
            ...defaultNestCliConfigurations,
            ...config,
            compilerOptions: {
                ...defaultNestCliConfigurations.compilerOptions,
                ...config.compilerOptions,
            },
        };
    }
    return { ...defaultNestCliConfigurations, ...config };
}
