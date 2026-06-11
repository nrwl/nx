"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleGetConfigureAiAgentsStatus = handleGetConfigureAiAgentsStatus;
exports.handleResetConfigureAiAgentsStatus = handleResetConfigureAiAgentsStatus;
const logger_1 = require("../logger");
const workspace_root_1 = require("../../utils/workspace-root");
const latest_nx_1 = require("./latest-nx");
const emptyStatus = {
    fullyConfiguredAgents: [],
    outdatedAgents: [],
    partiallyConfiguredAgents: [],
    nonConfiguredAgents: [],
};
let cachedStatus = null;
let isComputing = false;
let computationEpoch = 0;
const log = (...messageParts) => {
    logger_1.serverLogger.log('[AI-AGENTS]:', ...messageParts);
};
async function handleGetConfigureAiAgentsStatus() {
    if (cachedStatus !== null) {
        log('Returning cached agent configuration status');
        return {
            response: cachedStatus,
            description: 'handleGetConfigureAiAgentsStatus',
        };
    }
    if (!isComputing) {
        isComputing = true;
        const currentEpoch = computationEpoch;
        log('Starting agent configuration status computation');
        computeAgentStatuses()
            .then((result) => {
            if (currentEpoch !== computationEpoch) {
                log('Discarding stale agent configuration status computation (generation mismatch)');
                isComputing = false;
                return;
            }
            cachedStatus = result;
            isComputing = false;
            log('Agent configuration status computation completed:', `${result.fullyConfiguredAgents.length} fully configured,`, `${result.outdatedAgents.length} outdated,`, `${result.partiallyConfiguredAgents.length} partially configured,`, `${result.nonConfiguredAgents.length} non-configured`);
        })
            .catch((e) => {
            if (currentEpoch !== computationEpoch) {
                log('Discarding stale agent configuration status error (generation mismatch)');
                isComputing = false;
                return;
            }
            log(`Error computing agent configuration status: ${e.message}`);
            cachedStatus = { ...emptyStatus };
            isComputing = false;
        });
    }
    return {
        response: { ...emptyStatus },
        description: 'handleGetConfigureAiAgentsStatus',
    };
}
async function handleResetConfigureAiAgentsStatus() {
    log('Resetting cached agent configuration status.', `Previous state: cachedStatus=${cachedStatus === null ? 'null' : 'set'},`, `isComputing=${isComputing}.`, 'Next GET will recompute.');
    cachedStatus = null;
    isComputing = false;
    computationEpoch++;
    return {
        response: { success: true },
        description: 'handleResetConfigureAiAgentsStatus',
    };
}
async function computeAgentStatuses() {
    try {
        let modulePath;
        if (process.env.NX_USE_LOCAL === 'true') {
            log('Using local implementation (NX_USE_LOCAL=true)');
            modulePath = require.resolve('nx/src/ai/utils.js');
        }
        else {
            const tmpPath = await (0, latest_nx_1.getLatestNxTmpPath)();
            modulePath = require.resolve('nx/src/ai/utils.js', {
                paths: [tmpPath],
            });
        }
        const { getAgentConfigurations, supportedAgents } = await import(modulePath);
        const { fullyConfiguredAgents, partiallyConfiguredAgents, nonConfiguredAgents, } = await getAgentConfigurations([...supportedAgents], workspace_root_1.workspaceRoot);
        const toStatusInfo = (agent) => ({
            name: agent.name,
            displayName: agent.displayName,
        });
        return {
            fullyConfiguredAgents: fullyConfiguredAgents.map(toStatusInfo),
            outdatedAgents: fullyConfiguredAgents
                .filter((agent) => agent.outdated)
                .map(toStatusInfo),
            partiallyConfiguredAgents: partiallyConfiguredAgents.map(toStatusInfo),
            nonConfiguredAgents: nonConfiguredAgents.map(toStatusInfo),
        };
    }
    catch (error) {
        log('Failed to compute agent configuration status from latest Nx. Error:', error.message);
        return { ...emptyStatus };
    }
}
