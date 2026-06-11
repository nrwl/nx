"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initHandler = initHandler;
const child_process_1 = require("child_process");
const enquirer_1 = require("enquirer");
const fs_1 = require("fs");
const semver_1 = require("semver");
const add_nx_to_monorepo_1 = require("./implementation/add-nx-to-monorepo");
const add_nx_to_nest_1 = require("./implementation/add-nx-to-nest");
const add_nx_to_npm_repo_1 = require("./implementation/add-nx-to-npm-repo");
const angular_1 = require("./implementation/angular");
const add_nx_scripts_1 = require("./implementation/dot-nx/add-nx-scripts");
const child_process_2 = require("../../utils/child-process");
const fileutils_1 = require("../../utils/fileutils");
const versions_1 = require("../../utils/versions");
const utils_1 = require("./implementation/utils");
async function initHandler(options) {
    // strip the 'init' command itself so we don't forward it
    const args = process.argv.slice(3).join(' ');
    const version = process.env.NX_VERSION ?? ((0, semver_1.prerelease)(versions_1.nxVersion) ? versions_1.nxVersion : 'latest');
    if (process.env.NX_VERSION) {
        console.log(`Using version ${process.env.NX_VERSION}`);
    }
    if (options.useDotNxInstallation === true) {
        setupDotNxInstallation(version);
    }
    else if ((0, fs_1.existsSync)('package.json')) {
        const packageJson = (0, fileutils_1.readJsonFile)('package.json');
        if ((0, fs_1.existsSync)('angular.json')) {
            await (0, angular_1.addNxToAngularCliRepo)(options);
            (0, utils_1.printFinalMessage)({
                learnMoreLink: 'https://nx.dev/recipes/angular/migration/angular',
            });
            return;
        }
        else if (isNestCLI(packageJson)) {
            await (0, add_nx_to_nest_1.addNxToNest)(options, packageJson);
            (0, utils_1.printFinalMessage)({
                learnMoreLink: 'https://nx.dev/recipes/adopting-nx/adding-to-monorepo',
            });
            return;
        }
        else if ((0, utils_1.isMonorepo)(packageJson)) {
            await (0, add_nx_to_monorepo_1.addNxToMonorepo)({ ...options, legacy: true });
            (0, utils_1.printFinalMessage)({
                learnMoreLink: 'https://nx.dev/recipes/adopting-nx/adding-to-monorepo',
            });
        }
        else {
            await (0, add_nx_to_npm_repo_1.addNxToNpmRepo)({ ...options, legacy: true });
            (0, utils_1.printFinalMessage)({
                learnMoreLink: 'https://nx.dev/recipes/adopting-nx/adding-to-existing-project',
            });
        }
    }
    else {
        const useDotNxFolder = await (0, enquirer_1.prompt)([
            {
                name: 'useDotNxFolder',
                type: 'autocomplete',
                message: 'Where should your workspace be created?',
                choices: [
                    {
                        name: 'In a new folder under this directory',
                        value: 'false',
                    },
                    {
                        name: 'In this directory',
                        value: 'true',
                    },
                ],
            },
        ]).then((r) => r.useDotNxFolder === 'true');
        if (useDotNxFolder) {
            setupDotNxInstallation(version);
        }
        else {
            (0, child_process_1.execSync)(`npx --yes create-nx-workspace@${version} ${args}`, {
                stdio: [0, 1, 2],
                windowsHide: true,
            });
        }
    }
}
function isNestCLI(packageJson) {
    const combinedDependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
    };
    return ((0, fs_1.existsSync)('nest-cli.json') &&
        combinedDependencies['@nestjs/core'] &&
        combinedDependencies['@nestjs/cli']);
}
function setupDotNxInstallation(version) {
    if (process.platform !== 'win32') {
        console.log('Setting Nx up installation in `.nx`. You can run nx commands like: `./nx --help`');
    }
    else {
        console.log('Setting Nx up installation in `.nx`. You can run nx commands like: `./nx.bat --help`');
    }
    (0, add_nx_scripts_1.generateDotNxSetup)(version);
    // invokes the wrapper, thus invoking the initial installation process
    (0, child_process_2.runNxSync)('--version');
}
