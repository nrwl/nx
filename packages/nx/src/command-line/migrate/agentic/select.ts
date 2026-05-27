import { output } from '../../../utils/output';
import { migratePrompt } from '../safe-prompt';
import { detectInstalledAgents } from './detect-installed';
import { isInsideAgent } from './inception';
import { AGENT_DEFINITIONS } from './definitions';
import { AgentId, DetectedInstalledAgent, ResolvedAgentic } from './types';

/** Possible values for `--agentic` after yargs normalization. */
export type AgenticArg = undefined | boolean | AgentId;

const INSTALL_SUPPORTED_AGENTS_HINT = [
  'Install one of the supported agents and re-run the migration:',
  ...AGENT_DEFINITIONS.map((def) => `  - ${def.displayName}`),
];

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
        input.agentic === true || typeof input.agentic === 'string'
          ? 'Agentic flow skipped: nx detected this run is invoked from inside an AI agent — the outer agent drives the migration. The explicit --agentic flag is ignored in this context.'
          : 'Agentic flow skipped: nx detected this run is invoked from inside an AI agent.',
    });
    return { kind: 'inside-agent' };
  }

  const isInteractive = !!process.stdin.isTTY && !!process.stdout.isTTY;

  // Skip detection for the one case where the result is unused: explicit
  // `--agentic=false`. For every other path (explicit enable, explicit id, or
  // undefined-with-prompt) we either need the detection result to pick/verify
  // an agent or to decide whether the up-front prompt is even worth asking.
  if (input.agentic === false) {
    return { kind: 'disabled' };
  }

  const detected = await detectInstalledAgents(AGENT_DEFINITIONS);
  const { enabled, explicitId } = await resolveFlag(
    input,
    isInteractive,
    detected
  );

  if (!enabled) {
    return { kind: 'disabled' };
  }

  const selected = await selectAgent(detected, explicitId, isInteractive);

  return { kind: 'enabled', selectedAgent: selected };
}

async function resolveFlag(
  input: ResolveAgenticInput,
  isInteractive: boolean,
  detected: DetectedInstalledAgent[]
): Promise<{ enabled: boolean; explicitId?: AgentId }> {
  if (input.agentic === true) {
    requireInteractiveOrAbort(isInteractive);
    return { enabled: true };
  }
  if (typeof input.agentic === 'string') {
    requireInteractiveOrAbort(isInteractive);
    return { enabled: true, explicitId: input.agentic };
  }
  // undefined — fire the up-front prompt only when we have a TTY, something
  // agentic-eligible is queued, and at least one agent is installed. Without
  // an installed agent the user can't say "Yes" meaningfully — asking would
  // walk them into a dead end.
  if (!isInteractive) {
    return { enabled: false };
  }
  if (!input.migrations.some((m) => !!m.prompt)) {
    return { enabled: false };
  }
  if (detected.length === 0) {
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

async function firePromptForAgentic(
  migrations: ReadonlyArray<{ prompt?: string }>
): Promise<boolean> {
  // The "Yes"/"No" hints below assume at least one prompt-bearing migration is
  // queued. If we later extend the prompt to fire for generator-only runs
  // (validation-only), the hints need to branch.
  const promptCount = migrations.filter((m) => !!m.prompt).length;
  const yesHint = `Apply ${promptCount} prompt migration${
    promptCount === 1 ? '' : 's'
  } and validate generator output with an AI agent`;
  const noHint = `Skip prompts and run generators without AI validation`;

  // Blank line keeps the prompt from gluing to the previous `npm install`
  // output or any earlier orchestrator line.
  console.log();
  // `as any` because enquirer's TS types lag the runtime (per-choice `hint`
  // and `value` are supported but not in the .d.ts).
  const response = await migratePrompt<{ enable: 'yes' | 'no' }>({
    name: 'enable',
    type: 'autocomplete',
    message: 'Enable the agentic flow?',
    choices: [
      { name: 'yes', message: 'Yes', hint: yesHint },
      { name: 'no', message: 'No', hint: noHint },
    ],
    initial: 0,
  } as any);
  return response.enable === 'yes';
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
    if (detected.length === 0) {
      output.error({
        title: `The agent "${explicitId}" was requested via --agentic but no supported AI agent is installed on this machine.`,
        bodyLines: INSTALL_SUPPORTED_AGENTS_HINT,
      });
      throw new Error(`The requested agent "${explicitId}" is not installed.`);
    }
    output.error({
      title: `The agent "${explicitId}" was requested via --agentic but is not installed.`,
      bodyLines: [
        'Install the requested agent and re-run, or pass --agentic without an explicit agent to choose from installed ones.',
        'Currently installed agents:',
        ...detected.map((d) => `  - ${d.displayName} (${d.id})`),
      ],
    });
    throw new Error(`The requested agent "${explicitId}" is not installed.`);
  }

  if (detected.length === 0) {
    output.error({
      title:
        'Agentic flow was enabled, but no supported AI agent is installed on this machine.',
      bodyLines: INSTALL_SUPPORTED_AGENTS_HINT,
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
  const response = await migratePrompt<{ id: AgentId }>({
    name: 'id',
    type: 'select',
    message: 'Multiple AI agents detected. Which one should Nx use?',
    choices: detected.map((d) => ({ name: d.id, message: d.displayName })),
  });
  return detected.find((d) => d.id === response.id)!;
}
