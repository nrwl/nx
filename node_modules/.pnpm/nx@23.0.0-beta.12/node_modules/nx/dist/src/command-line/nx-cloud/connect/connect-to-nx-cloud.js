"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.onlyDefaultRunnerIsUsed = onlyDefaultRunnerIsUsed;
exports.connectToNxCloudIfExplicitlyAsked = connectToNxCloudIfExplicitlyAsked;
exports.connectWorkspaceToCloud = connectWorkspaceToCloud;
exports.connectToNxCloudCommand = connectToNxCloudCommand;
exports.connectExistingRepoToNxCloudPrompt = connectExistingRepoToNxCloudPrompt;
exports.connectToNxCloudWithPrompt = connectToNxCloudWithPrompt;
const tslib_1 = require("tslib");
const path_1 = require("path");
const handle_import_1 = require("../../../utils/handle-import");
const output_1 = require("../../../utils/output");
const configuration_1 = require("../../../config/configuration");
const tree_1 = require("../../../generators/tree");
const connect_to_nx_cloud_1 = require("../../../nx-cloud/generators/connect-to-nx-cloud/connect-to-nx-cloud");
const url_shorten_1 = require("../../../nx-cloud/utilities/url-shorten");
const nx_cloud_utils_1 = require("../../../utils/nx-cloud-utils");
const fileutils_1 = require("../../../utils/fileutils");
const child_process_1 = require("../../../utils/child-process");
const ab_testing_1 = require("../../../utils/ab-testing");
const versions_1 = require("../../../utils/versions");
const is_ci_1 = require("../../../utils/is-ci");
const native_1 = require("../../../native");
const package_manager_1 = require("../../../utils/package-manager");
const workspace_root_1 = require("../../../utils/workspace-root");
const git_utils_1 = require("../../../utils/git-utils");
const pc = tslib_1.__importStar(require("picocolors"));
const ora = require('ora');
const open = require('open');
function onlyDefaultRunnerIsUsed(nxJson) {
    const defaultRunner = nxJson.tasksRunnerOptions?.default?.runner;
    if (!defaultRunner) {
        // No tasks runner options OR no default runner defined:
        // - If access token defined, uses cloud runner
        // - If no access token defined, uses default
        return (!(nxJson.nxCloudAccessToken ??
            process.env.NX_CLOUD_AUTH_TOKEN ??
            process.env.NX_CLOUD_ACCESS_TOKEN) && !nxJson.nxCloudId);
    }
    return defaultRunner === 'nx/tasks-runners/default';
}
async function connectToNxCloudIfExplicitlyAsked(opts) {
    if (opts['cloud'] === true) {
        const nxJson = (0, configuration_1.readNxJson)();
        if (!onlyDefaultRunnerIsUsed(nxJson))
            return;
        output_1.output.log({
            title: '--cloud requires the workspace to be connected to Nx Cloud.',
        });
        (0, child_process_1.runNxSync)(`connect-to-nx-cloud`, {
            stdio: [0, 1, 2],
        });
        output_1.output.success({
            title: 'Your workspace has been successfully connected to Nx Cloud.',
        });
        process.exit(0);
    }
}
async function connectWorkspaceToCloud(options, directory = workspace_root_1.workspaceRoot) {
    const tree = new tree_1.FsTree(directory, false, 'connect-to-nx-cloud');
    const accessToken = await (0, connect_to_nx_cloud_1.connectToNxCloud)(tree, options);
    tree.lock();
    (0, tree_1.flushChanges)(directory, tree.listChanges());
    return accessToken;
}
async function connectToNxCloudCommand(options, command) {
    // `connectToNxCloudWithPrompt` (called from `migrate`) records its own stat; skip here to avoid double-counting.
    const selfRecord = !command;
    const baseMeta = {
        nodeVersion: process.versions.node,
        os: process.platform,
        packageManager: (0, package_manager_1.detectPackageManager)(),
        aiAgent: (0, native_1.isAiAgent)(),
        isCI: (0, is_ci_1.isCI)(),
    };
    if (selfRecord) {
        await (0, ab_testing_1.recordStat)({
            command: 'connect',
            nxVersion: versions_1.nxVersion,
            useCloud: true,
            meta: { type: 'start', ...baseMeta },
        });
    }
    try {
        const result = await runConnectToNxCloud(options, command);
        if (selfRecord) {
            await (0, ab_testing_1.recordStat)({
                command: 'connect',
                nxVersion: versions_1.nxVersion,
                useCloud: result,
                meta: { type: 'complete', ...baseMeta },
            });
        }
        return result;
    }
    catch (error) {
        if (selfRecord) {
            const message = (error instanceof Error && error.message) ||
                String(error ?? 'Unknown error');
            const errorName = typeof error?.code === 'string'
                ? error.code
                : error instanceof Error
                    ? error.name
                    : typeof error;
            await (0, ab_testing_1.recordStat)({
                command: 'connect',
                nxVersion: versions_1.nxVersion,
                useCloud: false,
                meta: {
                    type: 'error',
                    errorCode: 'UNKNOWN',
                    errorName,
                    errorMessage: message.slice(0, 500),
                    ...baseMeta,
                },
            });
        }
        throw error;
    }
}
async function runConnectToNxCloud(options, command) {
    const nxJson = (0, configuration_1.readNxJson)();
    const installationSource = process.env.NX_CONSOLE
        ? 'nx-console'
        : 'nx-connect';
    const hasRemote = !!(0, git_utils_1.getVcsRemoteInfo)();
    if (!hasRemote && options.checkRemote) {
        output_1.output.error({
            title: 'Missing VCS provider',
            bodyLines: [
                'Push this repository to a VCS provider (e.g., GitHub) and try again.',
                'Go to https://github.com/new to create a repository on GitHub.',
            ],
        });
        return false;
    }
    if ((0, nx_cloud_utils_1.isNxCloudUsed)(nxJson)) {
        const token = process.env.NX_CLOUD_AUTH_TOKEN ||
            process.env.NX_CLOUD_ACCESS_TOKEN ||
            nxJson.nxCloudAccessToken ||
            nxJson.nxCloudId;
        if (!token) {
            throw new Error(`Unable to authenticate. If you are connecting to Nx Cloud locally, set Nx Cloud ID in nx.json. If you are connecting in a CI context, either define accessToken in nx.json or set the NX_CLOUD_ACCESS_TOKEN env variable.`);
        }
        const connectCloudUrl = await (0, url_shorten_1.createNxCloudOnboardingURL)(installationSource, token, undefined, options?.generateToken === true);
        output_1.output.log({
            title: '✔ This workspace already has Nx Cloud set up',
            bodyLines: [
                'If you have not done so already, connect your workspace to your Nx Cloud account with the following URL:',
                '',
                `${connectCloudUrl}`,
            ],
        });
        return false;
    }
    const token = await connectWorkspaceToCloud({
        generateToken: options?.generateToken,
        installationSource: command ?? installationSource,
    });
    const connectCloudUrl = await (0, url_shorten_1.createNxCloudOnboardingURL)('nx-connect', token, undefined, options?.generateToken === true);
    try {
        const cloudConnectSpinner = ora(`Opening Nx Cloud ${connectCloudUrl} in your browser to connect your workspace.`).start();
        await sleep(2000);
        await open(connectCloudUrl);
        cloudConnectSpinner.succeed();
    }
    catch (e) {
        output_1.output.note({
            title: `Your Nx Cloud workspace is ready.`,
            bodyLines: [
                `To claim it, connect it to your Nx Cloud account:`,
                `- Go to the following URL to connect your workspace to Nx Cloud:`,
                '',
                `${connectCloudUrl}`,
            ],
        });
    }
    return true;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
async function connectExistingRepoToNxCloudPrompt(command = 'init', key = 'setupNxCloud') {
    const res = await nxCloudPrompt(key);
    await (0, ab_testing_1.recordStat)({
        command,
        nxVersion: versions_1.nxVersion,
        useCloud: res === 'yes',
        meta: {
            type: 'complete',
            setupCloudPrompt: ab_testing_1.messages.codeOfSelectedPromptMessage(key) || '',
            nxCloudArg: res,
            nodeVersion: process.versions.node,
            os: process.platform,
            packageManager: (0, package_manager_1.detectPackageManager)(),
            aiAgent: (0, native_1.isAiAgent)(),
            isCI: (0, is_ci_1.isCI)(),
        },
    });
    return res;
}
async function connectToNxCloudWithPrompt(command) {
    const setNxCloud = await nxCloudPrompt('setupNxCloud');
    let useCloud = false;
    if (setNxCloud === 'yes') {
        useCloud = await connectToNxCloudCommand({ generateToken: false }, command);
    }
    else if (setNxCloud === 'never') {
        const nxJsonPath = (0, path_1.join)(workspace_root_1.workspaceRoot, 'nx.json');
        const nxJson = (0, configuration_1.readNxJson)();
        if (nxJson) {
            nxJson.neverConnectToCloud = true;
            (0, fileutils_1.writeJsonFile)(nxJsonPath, nxJson);
        }
    }
    await (0, ab_testing_1.recordStat)({
        command,
        nxVersion: versions_1.nxVersion,
        useCloud,
        meta: {
            type: 'complete',
            setupCloudPrompt: ab_testing_1.messages.codeOfSelectedPromptMessage('setupNxCloud') || '',
            nxCloudArg: setNxCloud,
            nodeVersion: process.versions.node,
            os: process.platform,
            packageManager: (0, package_manager_1.detectPackageManager)(),
            aiAgent: (0, native_1.isAiAgent)(),
            isCI: (0, is_ci_1.isCI)(),
        },
    });
}
async function nxCloudPrompt(key) {
    const { message, choices, initial, footer, hint } = ab_testing_1.messages.getPrompt(key);
    const promptConfig = {
        name: 'NxCloud',
        message,
        type: 'autocomplete',
        choices,
        initial,
    }; // meeroslav: types in enquirer are not up to date
    if (footer) {
        promptConfig.footer = () => pc.dim(footer);
    }
    if (hint) {
        promptConfig.hint = () => pc.dim(hint);
    }
    const enquirer = await (0, handle_import_1.handleImport)('enquirer');
    return await enquirer
        .prompt([promptConfig])
        .then((a) => {
        return a.NxCloud;
    });
}
