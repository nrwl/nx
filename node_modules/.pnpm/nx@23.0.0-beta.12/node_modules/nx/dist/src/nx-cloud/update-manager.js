"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NxCloudClientUnavailableError = exports.NxCloudEnterpriseOutdatedError = void 0;
exports.verifyOrUpdateNxCloudClient = verifyOrUpdateNxCloudClient;
exports.getBundleInstallDefaultLocation = getBundleInstallDefaultLocation;
const tslib_1 = require("tslib");
const fs_1 = require("fs");
const zlib_1 = require("zlib");
const path_1 = require("path");
const os_1 = require("os");
const axios_1 = require("./utilities/axios");
const debug_logger_1 = require("./debug-logger");
const tar = tslib_1.__importStar(require("tar-stream"));
const cache_directory_1 = require("../utils/cache-directory");
const crypto_1 = require("crypto");
const workspace_root_1 = require("../utils/workspace-root");
class NxCloudEnterpriseOutdatedError extends Error {
    constructor(url) {
        super(`Nx Cloud instance hosted at ${url} is outdated`);
    }
}
exports.NxCloudEnterpriseOutdatedError = NxCloudEnterpriseOutdatedError;
class NxCloudClientUnavailableError extends Error {
    constructor() {
        super('No existing Nx Cloud client and failed to download new version');
    }
}
exports.NxCloudClientUnavailableError = NxCloudClientUnavailableError;
async function verifyOrUpdateNxCloudClient(options) {
    (0, debug_logger_1.debugLog)('Verifying current cloud bundle');
    const currentBundle = getLatestInstalledRunnerBundle();
    const apiUrl = process.env.NX_CLOUD_API || options?.url || 'https://cloud.nx.app';
    if (shouldVerifyInstalledRunnerBundle(currentBundle)) {
        const axios = (0, axios_1.createApiAxiosInstance)(options);
        let verifyBundleResponse;
        try {
            verifyBundleResponse = await verifyCurrentBundle(axios, currentBundle);
        }
        catch (e) {
            // Enterprise image compatibility, to be removed
            if (e.message === 'Request failed with status code 404' && apiUrl) {
                throw new NxCloudEnterpriseOutdatedError(apiUrl);
            }
            (0, debug_logger_1.debugLog)('Could not verify bundle. Resetting validation timer and using previously installed or default runner. Error: ', e);
            writeBundleVerificationLock();
            if (currentBundle === null) {
                throw new NxCloudClientUnavailableError();
            }
            if (currentBundle.version === 'NX_ENTERPRISE_OUTDATED_IMAGE') {
                throw new NxCloudEnterpriseOutdatedError(apiUrl);
            }
            const nxCloudClient = require(currentBundle.fullPath);
            if (nxCloudClient.commands === undefined) {
                throw new NxCloudEnterpriseOutdatedError(apiUrl);
            }
            return {
                version: currentBundle.version,
                nxCloudClient,
            };
        }
        if (verifyBundleResponse.data.valid) {
            (0, debug_logger_1.debugLog)('Currently installed bundle is valid');
            writeBundleVerificationLock();
            return {
                version: currentBundle.version,
                nxCloudClient: require(currentBundle.fullPath),
            };
        }
        const { version, url } = verifyBundleResponse.data;
        (0, debug_logger_1.debugLog)('Currently installed bundle is invalid, downloading version', version, ' from ', url);
        if (version === 'NX_ENTERPRISE_OUTDATED_IMAGE') {
            throw new NxCloudEnterpriseOutdatedError(apiUrl);
        }
        const fullPath = await downloadAndExtractClientBundle(axios, runnerBundleInstallDirectory, version, url);
        (0, debug_logger_1.debugLog)('Done: ', fullPath);
        const nxCloudClient = require(fullPath);
        if (nxCloudClient.commands === undefined) {
            throw new NxCloudEnterpriseOutdatedError(apiUrl);
        }
        return { version, nxCloudClient };
    }
    if (currentBundle === null) {
        throw new NxCloudClientUnavailableError();
    }
    (0, debug_logger_1.debugLog)('Done: ', currentBundle.fullPath);
    return {
        version: currentBundle.version,
        nxCloudClient: require(currentBundle.fullPath),
    };
}
function getBundleInstallDefaultLocation() {
    // When not in an Nx workspace (no nx.json), avoid creating a .nx folder
    // in the current directory. Instead, use a temp directory unique to the
    // NX_CLOUD_API URL so different cloud instances don't conflict.
    if (!(0, fs_1.existsSync)((0, path_1.join)(workspace_root_1.workspaceRoot, 'nx.json'))) {
        const apiUrl = process.env.NX_CLOUD_API || 'https://cloud.nx.app';
        const apiHash = (0, crypto_1.createHash)('sha256')
            .update(apiUrl)
            .digest('hex')
            .slice(0, 16);
        return (0, path_1.join)((0, os_1.tmpdir)(), 'nx-cloud-client', apiHash);
    }
    const legacyPath = (0, path_1.join)(workspace_root_1.workspaceRoot, 'node_modules', '.cache', 'nx', 'cloud');
    // this legacy path is used when the nx-cloud package is installed.
    // make sure to reuse it so that we don't `require` different the client bundles
    if ((0, fs_1.existsSync)(legacyPath)) {
        return legacyPath;
    }
    else {
        return (0, path_1.join)(cache_directory_1.cacheDir, 'cloud');
    }
}
const runnerBundleInstallDirectory = getBundleInstallDefaultLocation();
function getLatestInstalledRunnerBundle() {
    if (!(0, fs_1.existsSync)(runnerBundleInstallDirectory)) {
        (0, fs_1.mkdirSync)(runnerBundleInstallDirectory, { recursive: true });
    }
    try {
        const installedBundles = (0, fs_1.readdirSync)(runnerBundleInstallDirectory)
            .filter((potentialDirectory) => {
            return (0, fs_1.statSync)((0, path_1.join)(runnerBundleInstallDirectory, potentialDirectory)).isDirectory();
        })
            .map((fileOrDirectory) => ({
            version: fileOrDirectory,
            fullPath: (0, path_1.join)(runnerBundleInstallDirectory, fileOrDirectory),
        }));
        if (installedBundles.length === 0) {
            // No installed bundles
            return null;
        }
        return installedBundles[0];
    }
    catch (e) {
        console.log('Could not read runner bundle path:', e.message);
        return null;
    }
}
function shouldVerifyInstalledRunnerBundle(currentBundle) {
    if (process.env.NX_CLOUD_FORCE_REVALIDATE === 'true') {
        return true;
    }
    // No bundle, need to download anyway
    if (currentBundle != null) {
        (0, debug_logger_1.debugLog)('A local bundle currently exists: ', currentBundle);
        const lastVerification = getLatestBundleVerificationTimestamp();
        // Never been verified, need to verify
        if (lastVerification != null) {
            // If last verification was less than 30 minutes ago, return the current installed bundle
            const THIRTY_MINUTES = 30 * 60 * 1000;
            if (Date.now() - lastVerification < THIRTY_MINUTES) {
                (0, debug_logger_1.debugLog)('Last verification was within the past 30 minutes, will not verify this time');
                return false;
            }
            (0, debug_logger_1.debugLog)('Last verification was more than 30 minutes ago, verifying bundle is still valid');
        }
    }
    return true;
}
async function verifyCurrentBundle(axios, currentBundle) {
    return axios.get('/nx-cloud/client/verify', {
        params: currentBundle
            ? {
                version: currentBundle.version,
                contentHash: getBundleContentHash(currentBundle),
            }
            : {},
    });
}
function getLatestBundleVerificationTimestamp() {
    const lockfilePath = (0, path_1.join)(runnerBundleInstallDirectory, 'verify.lock');
    if ((0, fs_1.existsSync)(lockfilePath)) {
        const timestampAsString = (0, fs_1.readFileSync)(lockfilePath, 'utf-8');
        let timestampAsNumber;
        try {
            timestampAsNumber = Number(timestampAsString);
            return timestampAsNumber;
        }
        catch (e) {
            return null;
        }
    }
    return null;
}
function writeBundleVerificationLock() {
    const lockfilePath = (0, path_1.join)(runnerBundleInstallDirectory, 'verify.lock');
    (0, fs_1.writeFileSync)(lockfilePath, new Date().getTime().toString(), 'utf-8');
}
function getBundleContentHash(bundle) {
    if (bundle == null) {
        return null;
    }
    return hashDirectory(bundle.fullPath);
}
function hashDirectory(dir) {
    const files = (0, fs_1.readdirSync)(dir).sort();
    const hashes = files.map((file) => {
        const filePath = (0, path_1.join)(dir, file);
        const stat = (0, fs_1.statSync)(filePath);
        // If the current path is a directory, recursively hash the contents
        if (stat.isDirectory()) {
            return hashDirectory(filePath);
        }
        // If it's a file, hash the file contents
        const content = (0, fs_1.readFileSync)(filePath);
        return (0, crypto_1.createHash)('sha256').update(content).digest('hex');
    });
    // Hash the combined hashes of the directory's contents
    const combinedHashes = hashes.sort().join('');
    return (0, crypto_1.createHash)('sha256').update(combinedHashes).digest('hex');
}
async function downloadAndExtractClientBundle(axios, runnerBundleInstallDirectory, version, url) {
    let resp;
    try {
        resp = await axios.get(url, {
            responseType: 'stream',
        });
    }
    catch (e) {
        console.error('Error while updating Nx Cloud client bundle');
        throw e;
    }
    const bundleExtractLocation = (0, path_1.join)(runnerBundleInstallDirectory, version);
    if (!(0, fs_1.existsSync)(bundleExtractLocation)) {
        (0, fs_1.mkdirSync)(bundleExtractLocation);
    }
    return new Promise((res, rej) => {
        const extract = tar.extract();
        extract.on('entry', function (headers, stream, next) {
            if (headers.type === 'directory') {
                const directoryPath = (0, path_1.join)(bundleExtractLocation, headers.name);
                if (!(0, fs_1.existsSync)(directoryPath)) {
                    (0, fs_1.mkdirSync)(directoryPath, { recursive: true });
                }
                next();
                stream.resume();
            }
            else if (headers.type === 'file') {
                const outputFilePath = (0, path_1.join)(bundleExtractLocation, headers.name);
                const writeStream = (0, fs_1.createWriteStream)(outputFilePath);
                stream.pipe(writeStream);
                // Continue the tar stream after the write stream closes
                writeStream.on('close', () => {
                    next();
                });
                stream.resume();
            }
        });
        extract.on('error', (e) => {
            rej(e);
        });
        extract.on('finish', function () {
            removeOldClientBundles(version);
            writeBundleVerificationLock();
            res(bundleExtractLocation);
        });
        resp.data.pipe((0, zlib_1.createGunzip)()).pipe(extract);
    });
}
function removeOldClientBundles(currentInstallVersion) {
    const filesAndFolders = (0, fs_1.readdirSync)(runnerBundleInstallDirectory);
    for (let fileOrFolder of filesAndFolders) {
        const fileOrFolderPath = (0, path_1.join)(runnerBundleInstallDirectory, fileOrFolder);
        if (fileOrFolder !== currentInstallVersion) {
            (0, fs_1.rmSync)(fileOrFolderPath, { recursive: true });
        }
    }
}
