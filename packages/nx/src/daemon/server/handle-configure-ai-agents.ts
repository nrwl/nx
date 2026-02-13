import type { ConfigureAiAgentsStatusResponse } from '../message-types/configure-ai-agents';
import type { HandlerResult } from './server';
import { serverLogger } from '../logger';
import { workspaceRoot } from '../../utils/workspace-root';
import { getLatestNxTmpPath } from './latest-nx';

const emptyStatus: ConfigureAiAgentsStatusResponse = {
  fullyConfiguredAgents: [],
  outdatedAgents: [],
  partiallyConfiguredAgents: [],
  nonConfiguredAgents: [],
};

let cachedStatus: ConfigureAiAgentsStatusResponse | null = null;
let isComputing = false;

const log = (...messageParts: unknown[]) => {
  serverLogger.log('[AI-AGENTS]:', ...messageParts);
};

export async function handleGetConfigureAiAgentsStatus(): Promise<HandlerResult> {
  if (cachedStatus !== null) {
    log('Returning cached agent configuration status');
    return {
      response: cachedStatus,
      description: 'handleGetConfigureAiAgentsStatus',
    };
  }

  if (!isComputing) {
    isComputing = true;
    log('Starting agent configuration status computation');
    computeAgentStatuses()
      .then((result) => {
        cachedStatus = result;
        isComputing = false;
        log(
          'Agent configuration status computation completed:',
          `${result.fullyConfiguredAgents.length} fully configured,`,
          `${result.outdatedAgents.length} outdated,`,
          `${result.partiallyConfiguredAgents.length} partially configured,`,
          `${result.nonConfiguredAgents.length} non-configured`
        );
      })
      .catch((e) => {
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

export async function handleResetConfigureAiAgentsStatus(): Promise<HandlerResult> {
  log(
    'Resetting cached agent configuration status.',
    `Previous state: cachedStatus=${cachedStatus === null ? 'null' : 'set'},`,
    `isComputing=${isComputing}.`,
    'Next GET will recompute.'
  );
  cachedStatus = null;
  isComputing = false;
  return {
    response: { success: true },
    description: 'handleResetConfigureAiAgentsStatus',
  };
}

async function computeAgentStatuses(): Promise<ConfigureAiAgentsStatusResponse> {
  try {
    const tmpPath = await getLatestNxTmpPath();

    const modulePath = require.resolve('nx/src/ai/utils.js', {
      paths: [tmpPath],
    });

    const { getAgentConfigurations, supportedAgents } = await import(
      modulePath
    );

    const {
      fullyConfiguredAgents,
      partiallyConfiguredAgents,
      nonConfiguredAgents,
    } = await getAgentConfigurations([...supportedAgents], workspaceRoot);

    const toStatusInfo = (agent: { name: string; displayName: string }) => ({
      name: agent.name,
      displayName: agent.displayName,
    });

    return {
      fullyConfiguredAgents: fullyConfiguredAgents.map(toStatusInfo),
      outdatedAgents: fullyConfiguredAgents
        .filter((agent: { outdated: boolean }) => agent.outdated)
        .map(toStatusInfo),
      partiallyConfiguredAgents: partiallyConfiguredAgents.map(toStatusInfo),
      nonConfiguredAgents: nonConfiguredAgents.map(toStatusInfo),
    };
  } catch (error) {
    log(
      'Failed to compute agent configuration status from latest Nx. Error:',
      error.message
    );
    return { ...emptyStatus };
  }
}
