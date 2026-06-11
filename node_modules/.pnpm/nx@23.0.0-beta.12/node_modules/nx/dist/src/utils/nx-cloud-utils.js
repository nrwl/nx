"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNxCloudDisabled = isNxCloudDisabled;
exports.isNxCloudUsed = isNxCloudUsed;
exports.getNxCloudUrl = getNxCloudUrl;
function isNxCloudDisabled(nxJson) {
    return process.env.NX_NO_CLOUD === 'true' || nxJson.neverConnectToCloud;
}
function isNxCloudUsed(nxJson) {
    if (isNxCloudDisabled(nxJson)) {
        return false;
    }
    return (!!process.env.NX_CLOUD_AUTH_TOKEN ||
        !!process.env.NX_CLOUD_ACCESS_TOKEN ||
        !!nxJson.nxCloudAccessToken ||
        !!nxJson.nxCloudId ||
        !!Object.values(nxJson.tasksRunnerOptions ?? {}).find((r) => r.runner == '@nrwl/nx-cloud' || r.runner == 'nx-cloud'));
}
function getNxCloudUrl(nxJson) {
    const cloudRunner = Object.values(nxJson.tasksRunnerOptions ?? {}).find((r) => r.runner == '@nrwl/nx-cloud' || r.runner == 'nx-cloud');
    if (!cloudRunner &&
        !(nxJson.nxCloudAccessToken ||
            process.env.NX_CLOUD_AUTH_TOKEN ||
            process.env.NX_CLOUD_ACCESS_TOKEN) &&
        !nxJson.nxCloudId)
        throw new Error('nx-cloud runner not found in nx.json');
    return cloudRunner?.options?.url ?? nxJson.nxCloudUrl ?? 'https://nx.app';
}
