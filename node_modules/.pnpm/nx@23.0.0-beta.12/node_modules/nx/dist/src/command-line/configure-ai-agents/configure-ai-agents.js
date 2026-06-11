"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.configureAiAgentsHandler = configureAiAgentsHandler;
exports.configureAiAgentsHandlerImpl = configureAiAgentsHandlerImpl;
const tslib_1 = require("tslib");
const enquirer_1 = require("enquirer");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const pc = tslib_1.__importStar(require("picocolors"));
const constants_1 = require("../../ai/constants");
const detect_ai_agent_1 = require("../../ai/detect-ai-agent");
const utils_1 = require("../../ai/utils");
const client_1 = require("../../daemon/client/client");
const devkit_internals_1 = require("../../devkit-internals");
const output_1 = require("../../utils/output");
const package_manager_1 = require("../../utils/package-manager");
const provenance_1 = require("../../utils/provenance");
const versions_1 = require("../../utils/versions");
const workspace_root_1 = require("../../utils/workspace-root");
const handle_import_1 = require("../../utils/handle-import");
const ora = require("ora");
async function configureAiAgentsHandler(args, inner = false) {
    // When called as inner from the tmp install, just run the impl directly
    if (inner) {
        return await configureAiAgentsHandlerImpl(args);
    }
    // Use environment variable to force local execution
    if (process.env.NX_USE_LOCAL === 'true' ||
        process.env.NX_AI_FILES_USE_LOCAL === 'true') {
        await configureAiAgentsHandlerImpl(args);
        await resetDaemonAgentStatus();
        return;
    }
    // Skip downloading latest if the current version is already the latest
    try {
        const latestVersion = await (0, package_manager_1.resolvePackageVersionUsingRegistry)('nx', 'latest');
        if (latestVersion === versions_1.nxVersion) {
            return await configureAiAgentsHandlerImpl(args);
        }
    }
    catch {
        // If we can't check, proceed with download
    }
    let cleanup;
    try {
        await (0, provenance_1.ensurePackageHasProvenance)('nx', 'latest');
        const packageInstallResults = (0, devkit_internals_1.installPackageToTmp)('nx', 'latest');
        cleanup = packageInstallResults.cleanup;
        let modulePath = require.resolve('nx/src/command-line/configure-ai-agents/configure-ai-agents.js', { paths: [packageInstallResults.tempDir] });
        const module = await (0, handle_import_1.handleImport)(modulePath);
        await module.configureAiAgentsHandler(args, true);
        cleanup();
    }
    catch (error) {
        if (cleanup) {
            cleanup();
        }
        // Fall back to local implementation
        await configureAiAgentsHandlerImpl(args);
    }
    // Reset daemon cache using the local daemon client (the inner handler's
    // client belongs to the tmp install and isn't connected to our daemon)
    await resetDaemonAgentStatus();
}
async function configureAiAgentsHandlerImpl(options) {
    // Node 24 has stricter readline behavior, and enquirer is not checking for closed state
    // when invoking operations, thus you get an ERR_USE_AFTER_CLOSE error.
    process.on('uncaughtException', (error) => {
        if (error &&
            typeof error === 'object' &&
            'code' in error &&
            error['code'] === 'ERR_USE_AFTER_CLOSE')
            return;
        throw error;
    });
    const normalizedOptions = normalizeOptions(options);
    const { nonConfiguredAgents, partiallyConfiguredAgents, fullyConfiguredAgents, disabledAgents, } = await (0, utils_1.getAgentConfigurations)(normalizedOptions.agents, workspace_root_1.workspaceRoot);
    if (disabledAgents.length > 0) {
        const commandNames = disabledAgents.map((a) => {
            if (a.name === 'cursor')
                return '"cursor"';
            if (a.name === 'copilot')
                return '"code"/"code-insiders"';
            return a;
        });
        const title = commandNames.length === 1
            ? `${commandNames[0]} command not available.`
            : `CLI commands ${commandNames
                .map((c) => `${c}`)
                .join('/')} not available.`;
        output_1.output.log({
            title,
            bodyLines: [
                pc.dim('To manually configure the Nx MCP in your editor, install Nx Console (https://nx.dev/getting-started/editor-setup)'),
            ],
        });
    }
    if (normalizedOptions.agents.filter((agentName) => !disabledAgents.find((a) => a.name === agentName)).length === 0) {
        output_1.output.error({
            title: 'Please select at least one AI agent to configure.',
        });
        process.exit(1);
    }
    // important for wording
    const usingAllAgents = normalizedOptions.agents.length === utils_1.supportedAgents.length;
    if (normalizedOptions.check) {
        const outOfDateAgents = fullyConfiguredAgents.filter((a) => a?.outdated);
        // only error if something is fully configured but outdated
        if (normalizedOptions.check === 'outdated') {
            if (fullyConfiguredAgents.length === 0) {
                output_1.output.log({
                    title: 'No AI agents are configured',
                    bodyLines: [
                        'You can configure AI agents by running `nx configure-ai-agents`.',
                    ],
                });
                process.exit(0);
            }
            if (outOfDateAgents.length === 0) {
                output_1.output.success({
                    title: 'All configured AI agents are up to date',
                    bodyLines: fullyConfiguredAgents.map((a) => `- ${a.displayName}`),
                });
                process.exit(0);
            }
            else {
                output_1.output.log({
                    title: 'The following AI agents are out of date:',
                    bodyLines: [
                        ...outOfDateAgents.map((a) => {
                            const rulesPath = a.rulesPath;
                            const displayPath = rulesPath.startsWith(workspace_root_1.workspaceRoot)
                                ? (0, node_path_1.relative)(workspace_root_1.workspaceRoot, rulesPath)
                                : rulesPath;
                            return `- ${a.displayName} (${displayPath})`;
                        }),
                        '',
                        'You can update them by running `nx configure-ai-agents`.',
                    ],
                });
                process.exit(1);
            }
            // error on any partial, outdated or non-configured agent
        }
        else if (normalizedOptions.check === 'all') {
            if (partiallyConfiguredAgents.length === 0 &&
                outOfDateAgents.length === 0 &&
                nonConfiguredAgents.length === 0) {
                output_1.output.success({
                    title: `All ${!usingAllAgents ? 'selected' : 'supported'} AI agents are fully configured and up to date`,
                    bodyLines: fullyConfiguredAgents.map((a) => `- ${a.displayName}`),
                });
                process.exit(0);
            }
            output_1.output.error({
                title: 'The following agents are not fully configured or up to date:',
                bodyLines: [
                    ...partiallyConfiguredAgents,
                    ...outOfDateAgents,
                    ...nonConfiguredAgents,
                ].map((a) => getAgentChoiceForPrompt(a).message),
            });
            process.exit(1);
        }
    }
    // Automatic mode (no explicit --agents): update outdated agents and report
    // non-configured ones. When an AI agent is detected, also configure the
    // detected agent itself (even if non-configured or partial).
    const detectedAgent = (0, detect_ai_agent_1.detectAiAgent)();
    const agentsExplicitlyPassed = options.agents !== undefined;
    const isAutoMode = !agentsExplicitlyPassed && (options.interactive === false || detectedAgent);
    if (isAutoMode) {
        const agentsToConfig = [];
        const allConfigs = [
            ...nonConfiguredAgents,
            ...partiallyConfiguredAgents,
            ...fullyConfiguredAgents,
        ];
        // When an AI agent is detected, configure it if it needs it
        if (detectedAgent) {
            const detectedNeedsConfig = nonConfiguredAgents.some((a) => a.name === detectedAgent) ||
                partiallyConfiguredAgents.some((a) => a.name === detectedAgent) ||
                fullyConfiguredAgents.some((a) => a.name === detectedAgent && a.outdated);
            if (detectedNeedsConfig) {
                agentsToConfig.push(detectedAgent);
            }
        }
        // Update any other outdated agents
        for (const a of fullyConfiguredAgents) {
            if (a.outdated && !agentsToConfig.includes(a.name)) {
                agentsToConfig.push(a.name);
            }
        }
        const stillNonConfigured = nonConfiguredAgents.filter((a) => !agentsToConfig.includes(a.name));
        const nothingToDoMessage = detectedAgent
            ? `${utils_1.agentDisplayMap[detectedAgent] ?? detectedAgent} configuration is up to date`
            : 'All configured AI agents are up to date';
        if (agentsToConfig.length > 0) {
            const configSpinner = ora(`Configuring agent(s)...`).start();
            try {
                await (0, utils_1.configureAgents)(agentsToConfig, workspace_root_1.workspaceRoot, false);
                configSpinner.stop();
                output_1.output.success({
                    title: 'AI agents configured successfully',
                    bodyLines: agentsToConfig.map((name) => {
                        const config = allConfigs.find((a) => a.name === name);
                        return config
                            ? `${config.displayName}: ${getAgentConfiguredDescription(config)}`
                            : `- ${name}`;
                    }),
                });
            }
            catch (e) {
                configSpinner.fail('Failed to configure AI agents');
                output_1.output.error({
                    title: 'Error details:',
                    bodyLines: [e.message],
                });
                process.exit(1);
            }
        }
        else {
            output_1.output.success({
                title: nothingToDoMessage,
            });
        }
        if (stillNonConfigured.length > 0) {
            const agentNames = stillNonConfigured.map((a) => a.name);
            output_1.output.log({
                title: 'The following agents are not yet configured:',
                bodyLines: [
                    ...stillNonConfigured.map((a) => `- ${a.displayName}`),
                    '',
                    `Run: nx configure-ai-agents --agents ${agentNames.join(' ')}`,
                ],
            });
        }
        return;
    }
    // Interactive mode (or non-interactive with explicit --agents)
    const allAgentChoices = [];
    const preselectedIndices = [];
    let currentIndex = 0;
    // Partially configured agents first (highest priority)
    partiallyConfiguredAgents.forEach((a) => {
        allAgentChoices.push(getAgentChoiceForPrompt(a));
        preselectedIndices.push(currentIndex);
        currentIndex++;
    });
    // Outdated agents second
    for (const a of fullyConfiguredAgents) {
        if (a.outdated) {
            allAgentChoices.push(getAgentChoiceForPrompt(a));
            preselectedIndices.push(currentIndex);
            currentIndex++;
        }
    }
    // Non-configured agents last
    nonConfiguredAgents.forEach((a) => {
        allAgentChoices.push(getAgentChoiceForPrompt(a));
        currentIndex++;
    });
    if (allAgentChoices.length === 0) {
        output_1.output.success({
            title: `No new agents to configure. All ${!usingAllAgents ? 'selected' : 'supported'} AI agents are already configured:`,
            bodyLines: fullyConfiguredAgents.map((agent) => `- ${agent.displayName}`),
        });
        process.exit(0);
    }
    let selectedAgents;
    if (options.interactive !== false) {
        try {
            selectedAgents = (await (0, enquirer_1.prompt)({
                type: 'multiselect',
                name: 'agents',
                message: 'Which AI agents would you like to configure? (space to select, enter to confirm)',
                choices: allAgentChoices,
                initial: preselectedIndices,
                required: true,
                footer: function () {
                    const focused = this.focused;
                    return pc.dim(`  ${getAgentFooterDescription(focused.agentConfiguration)}`);
                },
            })).agents;
        }
        catch {
            process.exit(1);
        }
    }
    else {
        // non-interactive with explicit --agents: configure all requested
        selectedAgents = allAgentChoices.map((a) => a.name);
    }
    if (selectedAgents?.length === 0) {
        output_1.output.log({
            title: 'No agents selected',
        });
        process.exit(0);
    }
    const configSpinner = ora(`Configuring agent(s)...`).start();
    try {
        await (0, utils_1.configureAgents)(selectedAgents, workspace_root_1.workspaceRoot, false);
        // Combine all agent configurations for display
        const allAgentConfigs = [
            ...nonConfiguredAgents,
            ...partiallyConfiguredAgents,
            ...fullyConfiguredAgents,
        ];
        const configuredOrUpdatedAgents = allAgentConfigs.filter((a) => selectedAgents.includes(a.name) ||
            fullyConfiguredAgents.some((f) => f.name === a.name));
        configSpinner.stop();
        output_1.output.success({
            title: 'AI agents configured successfully',
            bodyLines: configuredOrUpdatedAgents.map((agent) => `${agent.displayName}: ${getAgentConfiguredDescription(agent)}`),
        });
        return;
    }
    catch (e) {
        configSpinner.fail('Failed to set up AI agents');
        output_1.output.error({
            title: 'Error details:',
            bodyLines: [e.message],
        });
        process.exit(1);
    }
}
/**
 * Get the verbose footer description for an agent.
 * Describes the end state per agent type.
 */
function getAgentFooterDescription(agent) {
    // Extract filename from rulesPath
    const rulesFile = agent.rulesPath.split('/').pop() || 'AGENTS.md';
    switch (agent.name) {
        case 'claude': {
            let description = `Installs Nx plugin (MCP + skills + agents). Updates ${rulesFile}.`;
            // Check if .mcp.json exists with nx-mcp - if so, mention cleanup
            const mcpJsonPath = (0, constants_1.claudeMcpJsonPath)(workspace_root_1.workspaceRoot);
            if ((0, node_fs_1.existsSync)(mcpJsonPath)) {
                try {
                    const mcpJsonContents = JSON.parse((0, node_fs_1.readFileSync)(mcpJsonPath, 'utf-8'));
                    if (mcpJsonContents?.mcpServers?.['nx-mcp']) {
                        description +=
                            ' Removes nx-mcp from .mcp.json (now handled by plugin).';
                    }
                }
                catch {
                    // Ignore errors reading .mcp.json
                }
            }
            return description;
        }
        case 'cursor':
        case 'copilot':
            return `Installs Nx Console (MCP). Adds skills and agents. Updates ${rulesFile}.`;
        case 'gemini':
        case 'opencode':
            return `Configures MCP server. Adds skills and agents. Updates ${rulesFile}.`;
        case 'codex':
            return `Configures MCP server. Adds skills. Updates ${rulesFile}.`;
        default:
            return '';
    }
}
/**
 * Get a compact description of what was configured for an agent.
 * Used in the post-configuration output.
 */
function getAgentConfiguredDescription(agent) {
    // Extract filename from rulesPath
    const rulesFile = agent.rulesPath.split('/').pop() || 'AGENTS.md';
    switch (agent.name) {
        case 'claude':
            return `Nx plugin (MCP + skills + agents) + ${rulesFile}`;
        case 'cursor':
        case 'copilot':
            return `Nx Console (MCP) + skills + ${rulesFile}`;
        case 'gemini':
        case 'opencode':
            return `MCP + skills + ${rulesFile}`;
        case 'codex':
            return `MCP + skills + ${rulesFile}`;
        default:
            return '';
    }
}
function getAgentChoiceForPrompt(agent) {
    const partiallyConfigured = agent.mcp !== agent.rules;
    const needsUpdate = partiallyConfigured || agent.outdated;
    return {
        name: agent.name,
        message: needsUpdate
            ? `${agent.displayName} (update available)`
            : agent.displayName,
        agentConfiguration: agent,
    };
}
function normalizeOptions(options) {
    const agents = (options.agents ?? utils_1.supportedAgents).filter((a) => utils_1.supportedAgents.includes(a));
    // it used to be just --check which was implicitly 'outdated'
    const check = (options.check === true ? 'outdated' : options.check) ?? false;
    return {
        ...options,
        agents,
        check,
    };
}
async function resetDaemonAgentStatus() {
    try {
        // Don't check daemonClient.enabled() — the CLI sets NX_DAEMON=false for
        // configure-ai-agents (it doesn't need the daemon to do its work), but a
        // daemon started by a previous command may still be running and serving
        // cached status. We just need to reach it to reset its cache.
        if (await client_1.daemonClient.isServerAvailable()) {
            await client_1.daemonClient.resetConfigureAiAgentsStatus();
        }
    }
    catch {
        // Daemon may not be running, that's fine
    }
    finally {
        // Close the daemon socket so the process can exit cleanly.
        client_1.daemonClient.reset();
    }
}
