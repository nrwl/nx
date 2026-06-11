"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NxKeyNotInstalledError = void 0;
exports.createNxKeyLicenseeInformation = createNxKeyLicenseeInformation;
exports.getNxKeyInformation = getNxKeyInformation;
const installation_directory_1 = require("./installation-directory");
const package_manager_1 = require("./package-manager");
const workspace_root_1 = require("./workspace-root");
function createNxKeyLicenseeInformation(nxKey) {
    if ('isPowerpack' in nxKey && nxKey.isPowerpack) {
        return `Licensed to ${nxKey.organizationName} for ${nxKey.seatCount} user${nxKey.seatCount > 1 ? 's' : ''} in ${nxKey.workspaceCount === 9999
            ? 'an unlimited number of'
            : nxKey.workspaceCount} workspace${nxKey.workspaceCount > 1 ? 's' : ''}.`;
    }
    else {
        return `Licensed to ${nxKey.organizationName}.`;
    }
}
// `await handleImport` walks node_modules and pays ~25ms per miss; `resolve`
// is just the filesystem lookup and is microseconds when the package is absent.
// Only treat MODULE_NOT_FOUND as "not installed" so unrelated errors (permission,
// corrupt package.json, etc.) still surface instead of being silently hidden.
function packageInstalled(name) {
    try {
        require.resolve(name, { paths: (0, installation_directory_1.getNxRequirePaths)() });
        return true;
    }
    catch (e) {
        if (e?.code === 'MODULE_NOT_FOUND')
            return false;
        throw e;
    }
}
async function getNxKeyInformation() {
    if (packageInstalled('@nx/key')) {
        const { getNxKeyInformationAsync } = await import('@nx/key');
        return getNxKeyInformationAsync(workspace_root_1.workspaceRoot);
    }
    if (packageInstalled('@nx/powerpack-license')) {
        const { getPowerpackLicenseInformation, getPowerpackLicenseInformationAsync, } = await import('@nx/powerpack-license');
        return (getPowerpackLicenseInformationAsync ?? getPowerpackLicenseInformation)(workspace_root_1.workspaceRoot);
    }
    throw new NxKeyNotInstalledError(new Error('MODULE_NOT_FOUND'));
}
class NxKeyNotInstalledError extends Error {
    constructor(e) {
        super(`The "@nx/key" package is needed to use Nx key enabled features. Please install it with ${(0, package_manager_1.getPackageManagerCommand)().addDev} @nx/key`, { cause: e });
    }
}
exports.NxKeyNotInstalledError = NxKeyNotInstalledError;
