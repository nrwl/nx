import { prompt } from 'enquirer';
import { existsSync, readFileSync } from 'node:fs';
import { relative } from 'node:path';
import * as pc from 'picocolors';
import { claudeMcpJsonPath } from '../../ai/constants';
import { detectAiAgent } from '../../ai/detect-ai-agent';
import {
  Agent,
  agentDisplayMap,
  AgentConfiguration,
  configureAgents,
  getAgentConfigurations,
  supportedAgents,
} from '../../ai/utils';
import { daemonClient } from '../../daemon/client/client';
import { installPackageToTmp } from '../../devkit-internals';
import { output } from '../../utils/output';
import { resolvePackageVersionUsingRegistry } from '../../utils/package-manager';
import { ensurePackageHasProvenance } from '../../utils/provenance';
import { nxVersion } from '../../utils/versions';
import { workspaceRoot } from '../../utils/workspace-root';
import { ConfigureAiAgentsOptions } from './command-object';
import ora = require('ora');
import { reportCommandRunEvent } from '../../analytics';
import { exitAndFlushAnalytics } from '../../analytics/analytics';

export async function configureAiAgentsHandler(
  args: ConfigureAiAgentsOptions,
  inner = false
): Promise<void> {
  reportCommandRunEvent('configure-ai-agents', undefined, args);
  // When called as inner from the tmp install, just run the impl directly
  if (inner) {
    return await configureAiAgentsHandlerImpl(args);
  }

  // Use environment variable to force local execution
  if (
    process.env.NX_USE_LOCAL === 'true' ||
    process.env.NX_AI_FILES_USE_LOCAL === 'true'
  ) {
    await configureAiAgentsHandlerImpl(args);
    await resetDaemonAgentStatus();
    return;
  }

  // Skip downloading latest if the current version is already the latest
  try {
    const latestVersion = await resolvePackageVersionUsingRegistry(
      'nx',
      'latest'
    );
    if (latestVersion === nxVersion) {
      return await configureAiAgentsHandlerImpl(args);
    }
  } catch {
    // If we can't check, proceed with download
  }

  let cleanup: () => void | undefined;
  try {
    await ensurePackageHasProvenance('nx', 'latest');
    const packageInstallResults = installPackageToTmp('nx', 'latest');
    cleanup = packageInstallResults.cleanup;

    let modulePath = require.resolve(
      'nx/src/command-line/configure-ai-agents/configure-ai-agents.js',
      { paths: [packageInstallResults.tempDir] }
    );

    const module = await import(modulePath);
    await module.configureAiAgentsHandler(args, true);
    cleanup();
  } catch (error) {
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

export async function configureAiAgentsHandlerImpl(
  options: ConfigureAiAgentsOptions
): Promise<void> {
  // Node 24 has stricter readline behavior, and enquirer is not checking for closed state
  // when invoking operations, thus you get an ERR_USE_AFTER_CLOSE error.
  process.on('uncaughtException', (error) => {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error['code'] === 'ERR_USE_AFTER_CLOSE'
    )
      return;
    throw error;
  });

  const normalizedOptions = normalizeOptions(options);

  const {
    nonConfiguredAgents,
    partiallyConfiguredAgents,
    fullyConfiguredAgents,
    disabledAgents,
  } = await getAgentConfigurations(normalizedOptions.agents, workspaceRoot);

  if (disabledAgents.length > 0) {
    const commandNames = disabledAgents.map((a) => {
      if (a.name === 'cursor') return '"cursor"';
      if (a.name === 'copilot') return '"code"/"code-insiders"';
      return a;
    });

    const title =
      commandNames.length === 1
        ? `${commandNames[0]} command not available.`
        : `CLI commands ${commandNames
            .map((c) => `${c}`)
            .join('/')} not available.`;

    output.log({
      title,
      bodyLines: [
        pc.dim(
          'To manually configure the Nx MCP in your editor, install Nx Console (https://nx.dev/getting-started/editor-setup)'
        ),
      ],
    });
  }

  if (
    normalizedOptions.agents.filter(
      (agentName) => !disabledAgents.find((a) => a.name === agentName)
    ).length === 0
  ) {
    output.error({
      title: 'Please select at least one AI agent to configure.',
    });
    exitAndFlushAnalytics(1);
  }

  // important for wording
  const usingAllAgents =
    normalizedOptions.agents.length === supportedAgents.length;

  if (normalizedOptions.check) {
    const outOfDateAgents = fullyConfiguredAgents.filter((a) => a?.outdated);

    // only error if something is fully configured but outdated
    if (normalizedOptions.check === 'outdated') {
      if (fullyConfiguredAgents.length === 0) {
        output.log({
          title: 'No AI agents are configured',
          bodyLines: [
            'You can configure AI agents by running `nx configure-ai-agents`.',
          ],
        });
        exitAndFlushAnalytics(0);
      }

      if (outOfDateAgents.length === 0) {
        output.success({
          title: 'All configured AI agents are up to date',
          bodyLines: fullyConfiguredAgents.map((a) => `- ${a.displayName}`),
        });
        exitAndFlushAnalytics(0);
      } else {
        output.log({
          title: 'The following AI agents are out of date:',
          bodyLines: [
            ...outOfDateAgents.map((a) => {
              const rulesPath = a.rulesPath;
              const displayPath = rulesPath.startsWith(workspaceRoot)
                ? relative(workspaceRoot, rulesPath)
                : rulesPath;
              return `- ${a.displayName} (${displayPath})`;
            }),
            '',
            'You can update them by running `nx configure-ai-agents`.',
          ],
        });
        exitAndFlushAnalytics(1);
      }
      // error on any partial, outdated or non-configured agent
    } else if (normalizedOptions.check === 'all') {
      if (
        partiallyConfiguredAgents.length === 0 &&
        outOfDateAgents.length === 0 &&
        nonConfiguredAgents.length === 0
      ) {
        output.success({
          title: `All ${
            !usingAllAgents ? 'selected' : 'supported'
          } AI agents are fully configured and up to date`,
          bodyLines: fullyConfiguredAgents.map((a) => `- ${a.displayName}`),
        });
        exitAndFlushAnalytics(0);
      }

      output.error({
        title: 'The following agents are not fully configured or up to date:',
        bodyLines: [
          ...partiallyConfiguredAgents,
          ...outOfDateAgents,
          ...nonConfiguredAgents,
        ].map((a) => getAgentChoiceForPrompt(a).message),
      });
      exitAndFlushAnalytics(1);
    }
  }

  // Automatic mode (no explicit --agents): update outdated agents and report
  // non-configured ones. When an AI agent is detected, also configure the
  // detected agent itself (even if non-configured or partial).
  const detectedAgent = detectAiAgent();
  const agentsExplicitlyPassed = options.agents !== undefined;
  const isAutoMode =
    !agentsExplicitlyPassed && (options.interactive === false || detectedAgent);

  if (isAutoMode) {
    const agentsToConfig: Agent[] = [];
    const allConfigs = [
      ...nonConfiguredAgents,
      ...partiallyConfiguredAgents,
      ...fullyConfiguredAgents,
    ];

    // When an AI agent is detected, configure it if it needs it
    if (detectedAgent) {
      const detectedNeedsConfig =
        nonConfiguredAgents.some((a) => a.name === detectedAgent) ||
        partiallyConfiguredAgents.some((a) => a.name === detectedAgent) ||
        fullyConfiguredAgents.some(
          (a) => a.name === detectedAgent && a.outdated
        );

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

    const stillNonConfigured = nonConfiguredAgents.filter(
      (a) => !agentsToConfig.includes(a.name)
    );

    const nothingToDoMessage = detectedAgent
      ? `${
          agentDisplayMap[detectedAgent] ?? detectedAgent
        } configuration is up to date`
      : 'All configured AI agents are up to date';

    if (agentsToConfig.length > 0) {
      const configSpinner = ora(`Configuring agent(s)...`).start();
      try {
        await configureAgents(agentsToConfig, workspaceRoot, false);
        configSpinner.stop();

        output.success({
          title: 'AI agents configured successfully',
          bodyLines: agentsToConfig.map((name) => {
            const config = allConfigs.find((a) => a.name === name);
            return config
              ? `${config.displayName}: ${getAgentConfiguredDescription(config)}`
              : `- ${name}`;
          }),
        });
      } catch (e) {
        configSpinner.fail('Failed to configure AI agents');
        output.error({
          title: 'Error details:',
          bodyLines: [e.message],
        });
        process.exit(1);
      }
    } else {
      output.success({
        title: nothingToDoMessage,
      });
    }

    if (stillNonConfigured.length > 0) {
      const agentNames = stillNonConfigured.map((a) => a.name);
      output.log({
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
  const allAgentChoices: AgentPromptChoice[] = [];
  const preselectedIndices: number[] = [];
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
    output.success({
      title: `No new agents to configure. All ${
        !usingAllAgents ? 'selected' : 'supported'
      } AI agents are already configured:`,
      bodyLines: fullyConfiguredAgents.map((agent) => `- ${agent.displayName}`),
    });
    exitAndFlushAnalytics(0);
  }

  let selectedAgents: Agent[];
  if (options.interactive !== false) {
    try {
      selectedAgents = (
        await prompt<{ agents: Agent[] }>({
          type: 'multiselect',
          name: 'agents',
          message:
            'Which AI agents would you like to configure? (space to select, enter to confirm)',
          choices: allAgentChoices,
          initial: preselectedIndices,
          required: true,
          footer: function () {
            const focused = this.focused as AgentPromptChoice;
            return pc.dim(
              `  ${getAgentFooterDescription(focused.agentConfiguration)}`
            );
          },
        } as any)
      ).agents;
    } catch {
      exitAndFlushAnalytics(1);
    }
  } else {
    // non-interactive with explicit --agents: configure all requested
    selectedAgents = allAgentChoices.map((a) => a.name);
  }

  if (selectedAgents?.length === 0) {
    output.log({
      title: 'No agents selected',
    });
    exitAndFlushAnalytics(0);
  }

  const configSpinner = ora(`Configuring agent(s)...`).start();
  try {
    await configureAgents(selectedAgents, workspaceRoot, false);

    // Combine all agent configurations for display
    const allAgentConfigs = [
      ...nonConfiguredAgents,
      ...partiallyConfiguredAgents,
      ...fullyConfiguredAgents,
    ];
    const configuredOrUpdatedAgents = allAgentConfigs.filter(
      (a) =>
        selectedAgents.includes(a.name) ||
        fullyConfiguredAgents.some((f) => f.name === a.name)
    );

    configSpinner.stop();

    output.success({
      title: 'AI agents configured successfully',
      bodyLines: configuredOrUpdatedAgents.map(
        (agent) =>
          `${agent.displayName}: ${getAgentConfiguredDescription(agent)}`
      ),
    });

    return;
  } catch (e) {
    configSpinner.fail('Failed to set up AI agents');
    output.error({
      title: 'Error details:',
      bodyLines: [e.message],
    });
    exitAndFlushAnalytics(1);
  }
}

type AgentPromptChoice = {
  name: Agent;
  message: string;
  agentConfiguration: AgentConfiguration;
};

/**
 * Get the verbose footer description for an agent.
 * Describes the end state per agent type.
 */
function getAgentFooterDescription(agent: AgentConfiguration): string {
  // Extract filename from rulesPath
  const rulesFile = agent.rulesPath.split('/').pop() || 'AGENTS.md';

  switch (agent.name) {
    case 'claude': {
      let description = `Installs Nx plugin (MCP + skills + agents). Updates ${rulesFile}.`;
      // Check if .mcp.json exists with nx-mcp - if so, mention cleanup
      const mcpJsonPath = claudeMcpJsonPath(workspaceRoot);
      if (existsSync(mcpJsonPath)) {
        try {
          const mcpJsonContents = JSON.parse(
            readFileSync(mcpJsonPath, 'utf-8')
          );
          if (mcpJsonContents?.mcpServers?.['nx-mcp']) {
            description +=
              ' Removes nx-mcp from .mcp.json (now handled by plugin).';
          }
        } catch {
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
function getAgentConfiguredDescription(agent: AgentConfiguration): string {
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

function getAgentChoiceForPrompt(agent: AgentConfiguration): AgentPromptChoice {
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

type NormalizedAiAgentSetupOptions = Omit<
  ConfigureAiAgentsOptions,
  'agents'
> & {
  agents: Agent[];
};
function normalizeOptions(
  options: ConfigureAiAgentsOptions
): NormalizedAiAgentSetupOptions {
  const agents = (options.agents ?? supportedAgents).filter((a) =>
    supportedAgents.includes(a as Agent)
  ) as Agent[];
  // it used to be just --check which was implicitly 'outdated'
  const check = (options.check === true ? 'outdated' : options.check) ?? false;
  return {
    ...options,
    agents,
    check,
  };
}

async function resetDaemonAgentStatus(): Promise<void> {
  try {
    // Don't check daemonClient.enabled() — the CLI sets NX_DAEMON=false for
    // configure-ai-agents (it doesn't need the daemon to do its work), but a
    // daemon started by a previous command may still be running and serving
    // cached status. We just need to reach it to reset its cache.
    if (await daemonClient.isServerAvailable()) {
      await daemonClient.resetConfigureAiAgentsStatus();
    }
  } catch {
    // Daemon may not be running, that's fine
  } finally {
    // Close the daemon socket so the process can exit cleanly.
    daemonClient.reset();
  }
}
