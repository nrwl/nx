import { prompt } from 'enquirer';
import { output } from '../../../utils/output';
import { detectInstalledAgents } from './detect-installed';
import { isInsideAgent } from './inception';
import { AGENT_DEFINITIONS } from './registry';
import {
  AgentDefinition,
  AgentId,
  DetectedInstalledAgent,
  ResolvedAgentic,
} from './types';

/** Possible values for `--agentic` after yargs normalization. */
export type AgenticArg = undefined | boolean | AgentId;

export interface ResolveAgenticInput {
  agentic: AgenticArg;
  migrations: ReadonlyArray<{ prompt?: string }>;
}

/**
 * Resolves the agentic state for a `--run-migrations` invocation. Runs once,
 * before the migration loop, and its result is cached for every entry.
 */
export async function resolveAgentic(
  input: ResolveAgenticInput
): Promise<ResolvedAgentic> {
  if (isInsideAgent()) {
    output.log({
      title:
        'Agentic flow skipped: nx detected this run is invoked from inside an AI agent.',
    });
    return { kind: 'inside-agent' };
  }

  const isInteractive = !!process.stdin.isTTY && !!process.stdout.isTTY;
  const { enabled, explicitId } = await resolveFlag(input, isInteractive);

  if (!enabled) {
    return { kind: 'disabled' };
  }

  const detected = await detectInstalledAgents(AGENT_DEFINITIONS);
  const selected = await selectAgent(detected, explicitId, isInteractive);

  return { kind: 'enabled', selectedAgent: selected };
}

async function resolveFlag(
  input: ResolveAgenticInput,
  isInteractive: boolean
): Promise<{ enabled: boolean; explicitId?: AgentId }> {
  if (input.agentic === true) {
    requireInteractiveOrAbort(isInteractive);
    return { enabled: true };
  }
  if (typeof input.agentic === 'string') {
    requireInteractiveOrAbort(isInteractive);
    return { enabled: true, explicitId: input.agentic };
  }
  if (input.agentic === false) {
    return { enabled: false };
  }
  // undefined — fire the up-front prompt only when we have a TTY and there is
  // something agentic-eligible queued.
  if (!isInteractive) {
    return { enabled: false };
  }
  if (!shouldPromptForAgentic(input.migrations)) {
    return { enabled: false };
  }
  return { enabled: await firePromptForAgentic(input.migrations) };
}

function requireInteractiveOrAbort(isInteractive: boolean): void {
  if (isInteractive) return;
  output.error({
    title: 'The agentic flow is interactive-only in this release.',
    bodyLines: [
      'Re-run in an interactive terminal, or pass `--agentic=false` to skip the agentic flow.',
    ],
  });
  throw new Error('Agentic flow requires an interactive terminal.');
}

function shouldPromptForAgentic(
  migrations: ReadonlyArray<{ prompt?: string }>
): boolean {
  return migrations.some((m) => !!m.prompt);
}

async function firePromptForAgentic(
  migrations: ReadonlyArray<{ prompt?: string }>
): Promise<boolean> {
  // Caller (`resolveFlag`) guarantees at least one prompt-bearing migration.
  const promptCount = migrations.filter((m) => !!m.prompt).length;
  const hint = `AI agent will apply ${promptCount} prompt-based migration${
    promptCount === 1 ? '' : 's'
  } and review generator output.`;

  // Blank line keeps the prompt from gluing to the previous `npm install`
  // output or any earlier orchestrator line.
  console.log();
  const response = await prompt<{ enable: boolean }>({
    name: 'enable',
    type: 'confirm',
    message: 'Enable the agentic flow?',
    hint,
    initial: true,
  });
  return response.enable;
}

async function selectAgent(
  detected: DetectedInstalledAgent[],
  explicitId: AgentId | undefined,
  isInteractive: boolean
): Promise<DetectedInstalledAgent> {
  if (explicitId) {
    const match = detected.find((d) => d.id === explicitId);
    if (match) {
      return match;
    }
    const installedList =
      detected.length > 0
        ? detected.map((d) => `  - ${d.displayName} (${d.id})`)
        : ['  (none detected)'];
    output.error({
      title: `The agent "${explicitId}" was requested via --agentic but is not installed.`,
      bodyLines: [
        'Install the requested agent and re-run, or pass --agentic without an explicit agent to choose from installed ones.',
        'Currently installed agents:',
        ...installedList,
      ],
    });
    throw new Error(`The requested agent "${explicitId}" is not installed.`);
  }

  if (detected.length === 0) {
    output.error({
      title:
        'Agentic flow was enabled, but no supported AI agent is installed on this machine.',
      bodyLines: [
        'Install one of the supported agents and re-run the migration:',
        ...AGENT_DEFINITIONS.map(
          (def: AgentDefinition) => `  - ${def.displayName}`
        ),
      ],
    });
    throw new Error('No installed AI agent available.');
  }

  if (detected.length === 1) {
    const only = detected[0]!;
    output.log({
      title: `Using ${only.displayName} for the agentic flow.`,
    });
    return only;
  }

  // 2+ detected. The picker only fires interactively. We've already required
  // a TTY before resolving an enabled state, so this is defense-in-depth.
  requireInteractiveOrAbort(isInteractive);

  // Blank line for the same reason as `firePromptForAgentic`.
  console.log();
  const response = await prompt<{ id: AgentId }>({
    name: 'id',
    type: 'select',
    message: 'Multiple AI agents detected. Which one should Nx use?',
    choices: detected.map((d) => ({ name: d.id, message: d.displayName })),
  });
  return detected.find((d) => d.id === response.id)!;
}
