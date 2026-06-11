"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printSuccessMessage = printSuccessMessage;
exports.connectToNxCloud = connectToNxCloud;
const child_process_1 = require("child_process");
const output_1 = require("../../../utils/output");
const json_1 = require("../../../generators/utils/json");
const nx_json_1 = require("../../../generators/utils/nx-json");
const format_changed_files_with_prettier_if_available_1 = require("../../../generators/internal-utils/format-changed-files-with-prettier-if-available");
const url_shorten_1 = require("../../utilities/url-shorten");
const get_cloud_options_1 = require("../../utilities/get-cloud-options");
const path_1 = require("path");
const git_utils_1 = require("../../../utils/git-utils");
function printCloudConnectionDisabledMessage() {
    output_1.output.error({
        title: `Connections to Nx Cloud are disabled for this workspace`,
        bodyLines: [
            `This was an intentional decision by someone on your team.`,
            `Nx Cloud cannot and will not be enabled.`,
            ``,
            `To allow connections to Nx Cloud again, remove the 'neverConnectToCloud'`,
            `property in nx.json.`,
        ],
    });
}
function getRootPackageName(tree, directory) {
    let packageJson;
    try {
        const packageJsonPath = (0, path_1.join)(directory, 'package.json');
        packageJson = (0, json_1.readJson)(tree, packageJsonPath);
    }
    catch (e) { }
    return packageJson?.name ?? 'my-workspace';
}
function getNxInitDate() {
    try {
        const nxInitIso = (0, child_process_1.execSync)('git log --diff-filter=A --follow --format=%aI -- nx.json | tail -1', { stdio: 'pipe', windowsHide: true })
            .toString()
            .trim();
        const nxInitDate = new Date(nxInitIso);
        return nxInitDate.toISOString();
    }
    catch (e) {
        return new Date().toISOString();
    }
}
async function createNxCloudWorkspaceV1(workspaceName, installationSource, nxInitDate) {
    const apiUrl = (0, get_cloud_options_1.getCloudUrl)();
    const response = await require('axios').post(`${apiUrl}/nx-cloud/create-org-and-workspace`, {
        workspaceName,
        installationSource,
        nxInitDate,
    });
    if (response.data.message) {
        throw new Error(response.data.message);
    }
    return response.data;
}
async function createNxCloudWorkspaceV2(workspaceName, installationSource, nxInitDate) {
    const apiUrl = (0, get_cloud_options_1.getCloudUrl)();
    const response = await require('axios').post(`${apiUrl}/nx-cloud/v2/create-org-and-workspace`, {
        workspaceName,
        installationSource,
        nxInitDate,
    });
    if (response.data.message) {
        throw new Error(response.data.message);
    }
    return response.data;
}
async function printSuccessMessage(token, installationSource) {
    const connectCloudUrl = await (0, url_shorten_1.createNxCloudOnboardingURL)(installationSource, token, undefined, false);
    output_1.output.note({
        title: `Your Self-Healing CI and Remote Caching setup is almost complete`,
        bodyLines: [
            `1. Commit your changes and push a pull request to your repository.`,
            `2. Go to Nx Cloud and finish the setup: ${connectCloudUrl}`,
        ],
    });
    return connectCloudUrl;
}
function addNxCloudAccessTokenToNxJson(tree, token, directory = '') {
    const nxJsonPath = (0, path_1.join)(directory, 'nx.json');
    if (tree.exists(nxJsonPath)) {
        (0, json_1.updateJson)(tree, (0, path_1.join)(directory, 'nx.json'), (nxJson) => {
            const overrideUrl = process.env.NX_CLOUD_API || process.env.NRWL_API;
            if (overrideUrl) {
                nxJson.nxCloudUrl = overrideUrl;
            }
            nxJson.nxCloudAccessToken = token;
            return nxJson;
        });
    }
}
function addNxCloudIdToNxJson(tree, nxCloudId, directory = '') {
    const nxJsonPath = (0, path_1.join)(directory, 'nx.json');
    if (tree.exists(nxJsonPath)) {
        (0, json_1.updateJson)(tree, (0, path_1.join)(directory, 'nx.json'), (nxJson) => {
            const overrideUrl = process.env.NX_CLOUD_API || process.env.NRWL_API;
            if (overrideUrl) {
                nxJson.nxCloudUrl = overrideUrl;
            }
            nxJson.nxCloudId = nxCloudId;
            return nxJson;
        });
    }
}
async function connectToNxCloud(tree, schema, nxJson = (0, nx_json_1.readNxJson)(tree)) {
    schema.installationSource ??= 'user';
    if (nxJson?.neverConnectToCloud) {
        printCloudConnectionDisabledMessage();
        return null;
    }
    const remoteInfo = await (0, git_utils_1.getVcsRemoteInfo)();
    const isGitHubDetected = schema.github ?? remoteInfo?.domain === 'github.com';
    let responseFromCreateNxCloudWorkspaceV1;
    let responseFromCreateNxCloudWorkspaceV2;
    /**
     * Do not create an Nx Cloud token if the user is using GitHub and
     * is running `nx-connect` AND `token` is undefined (override)
     */
    if (!schema.generateToken &&
        isGitHubDetected &&
        (schema.installationSource === 'nx-connect' ||
            schema.installationSource === 'nx-console'))
        return null;
    try {
        responseFromCreateNxCloudWorkspaceV2 = await createNxCloudWorkspaceV2(getRootPackageName(tree, schema.directory), schema.installationSource, getNxInitDate());
    }
    catch (e) {
        if (e.response?.status === 404) {
            responseFromCreateNxCloudWorkspaceV1 = await createNxCloudWorkspaceV1(getRootPackageName(tree, schema.directory), schema.installationSource, getNxInitDate());
        }
        else {
            throw e;
        }
    }
    if (responseFromCreateNxCloudWorkspaceV2) {
        addNxCloudIdToNxJson(tree, responseFromCreateNxCloudWorkspaceV2?.nxCloudId, schema.directory);
        await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree, {
            silent: schema.hideFormatLogs,
        });
        return responseFromCreateNxCloudWorkspaceV2.nxCloudId;
    }
    else if (responseFromCreateNxCloudWorkspaceV1) {
        addNxCloudAccessTokenToNxJson(tree, responseFromCreateNxCloudWorkspaceV1?.token, schema.directory);
        await (0, format_changed_files_with_prettier_if_available_1.formatChangedFilesWithPrettierIfAvailable)(tree, {
            silent: schema.hideFormatLogs,
        });
        return responseFromCreateNxCloudWorkspaceV1.token;
    }
    else {
        throw new Error('Could not create an Nx Cloud Workspace. Please try again.');
    }
}
async function connectToNxCloudGenerator(tree, options) {
    await connectToNxCloud(tree, options);
}
exports.default = connectToNxCloudGenerator;
