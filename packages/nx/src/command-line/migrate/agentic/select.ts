import { existsSync, readFileSync, writeFileSync } from 'fs';
import { applyEdits, modify } from 'jsonc-parser';
import { join } from 'path';
import * as pc from 'picocolors';
import { output } from '../../../utils/output';
import { workspaceRoot } from '../../../utils/workspace-root';
import {
  type MigratePromptChoices,
  reportMigratePrompt,
} from '../migrate-analytics';
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
  /** The `--interactive` flag; `false` (`--no-interactive`) disables all prompting. */
  interactive?: boolean;
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

  const isInteractive =
    !!process.stdin.isTTY &&
    !!process.stdout.isTTY &&
    input.interactive !== false;

  // Skip detection for the one case where the result is unused: explicit
  // `--agentic=false`. For every other path (explicit enable, explicit id, or
  // undefined-with-prompt) we either need the detection result to pick/verify
  // an agent or to decide whether the up-front prompt is even worth asking.
  if (input.agentic === false) {
    return { kind: 'disabled' };
  }

  const detected = await detectInstalledAgents(AGENT_DEFINITIONS);
  const { enabled, explicitId, persist } = await resolveFlag(
    input,
    isInteractive,
    detected
  );

  if (!enabled) {
    if (persist === false) {
      persistAgenticChoice(false);
    }
    return { kind: 'disabled' };
  }

  const selected = await selectAgent(detected, explicitId, isInteractive);

  if (persist === true) {
    persistAgenticChoice(true);
  } else if (persist === 'pin') {
    persistAgenticChoice(selected.id);
  }

  return { kind: 'enabled', selectedAgent: selected };
}

/**
 * What to persist to `nx.json` `migrate.agentic` after the up-front prompt:
 * `undefined` = don't persist, `false` = persist disabled, `true` = persist
 * enabled (resolve the agent each run), `'pin'` = persist the selected agent id.
 */
type PersistChoice = undefined | boolean | 'pin';

async function resolveFlag(
  input: ResolveAgenticInput,
  isInteractive: boolean,
  detected: DetectedInstalledAgent[]
): Promise<{
  enabled: boolean;
  explicitId?: AgentId;
  persist?: PersistChoice;
}> {
  if (input.agentic === true) {
    if (!isInteractive) {
      warnAgenticInteractiveOnly();
      return { enabled: false };
    }
    return { enabled: true };
  }
  if (typeof input.agentic === 'string') {
    if (!isInteractive) {
      warnAgenticInteractiveOnly();
      return { enabled: false };
    }
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
  return firePromptForAgentic(input.migrations, detected);
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

function warnAgenticInteractiveOnly(): void {
  output.warn({
    title:
      'Skipping the agentic flow: it is interactive-only in this release and this run is non-interactive.',
    bodyLines: [
      'Continuing the migration without the agentic flow. Re-run in an interactive terminal to use it.',
    ],
  });
}

async function firePromptForAgentic(
  migrations: ReadonlyArray<{ prompt?: string }>,
  detected: DetectedInstalledAgent[]
): Promise<{ enabled: boolean; persist?: PersistChoice }> {
  // The apply hint assumes at least one prompt-bearing migration is queued. If
  // we later extend the prompt to fire for generator-only runs (validation-
  // only), the hint needs to branch.
  const promptCount = migrations.filter((m) => !!m.prompt).length;
  const applyHint = `Apply ${promptCount} prompt migration${
    promptCount === 1 ? '' : 's'
  } and validate generator output with an AI agent`;
  const skipHint = `Skip prompts and run generators without AI validation`;
  const rememberHint = `Saved to nx.json so Nx won't ask again`;

  // The pin-vs-flexible distinction only matters when more than one agent is
  // installed. With a single agent, "always" simply persists `true` and the
  // pin option is dropped.
  const multipleAgents = detected.length > 1;
  const choices = [
    {
      name: 'yes-once',
      message: 'Yes, just this time',
      description: applyHint,
    },
    {
      name: 'yes-flex',
      message: multipleAgents
        ? "Yes, always (I'll pick the agent each run)"
        : 'Yes, always',
      description: rememberHint,
    },
    ...(multipleAgents
      ? [
          {
            name: 'yes-pin',
            message: 'Yes, always with the same agent',
            description: rememberHint,
          },
        ]
      : []),
    { name: 'no-once', message: 'No, just this time', description: skipHint },
    { name: 'no-never', message: 'No, never', description: rememberHint },
  ];

  // Blank line keeps the prompt from gluing to the previous `npm install`
  // output or any earlier orchestrator line.
  console.log();
  // `as any`: `footer` and per-choice `description` aren't in enquirer's .d.ts.
  const response = await migratePrompt<{
    choice: MigratePromptChoices['agentic'];
  }>({
    name: 'choice',
    type: 'select',
    message: 'Enable the agentic flow?',
    choices,
    initial: 0,
    footer: function () {
      const focused = this.focused as { description?: string };
      return focused?.description ? pc.dim(`  ${focused.description}`) : '';
    },
  } as any);

  reportMigratePrompt('agentic', response.choice);

  switch (response.choice) {
    case 'yes-once':
      return { enabled: true };
    case 'yes-flex':
      return { enabled: true, persist: true };
    case 'yes-pin':
      return { enabled: true, persist: 'pin' };
    case 'no-never':
      return { enabled: false, persist: false };
    case 'no-once':
    default:
      return { enabled: false };
  }
}

// Persists the user's agentic choice to `nx.json` so the up-front prompt is
// skipped on future runs. Edits the raw file in place via jsonc-parser, so it
// touches only the `migrate.agentic` key and preserves comments, formatting,
// and any `extends` preset (the prompt fires mid-migration, so a silent
// reformat would be surprising). Never throws - a failed write only costs the
// user the prompt again next time.
function persistAgenticChoice(value: boolean | AgentId): void {
  const nxJsonPath = join(workspaceRoot, 'nx.json');
  if (!existsSync(nxJsonPath)) {
    output.warn({
      title: `Could not save your agentic choice: no nx.json found at the workspace root.`,
    });
    return;
  }
  try {
    const content = readFileSync(nxJsonPath, 'utf-8');
    const edits = modify(content, ['migrate', 'agentic'], value, {
      formattingOptions: { insertSpaces: true, tabSize: 2 },
    });
    writeFileSync(nxJsonPath, applyEdits(content, edits));
    output.log({
      title: `Saved your choice to nx.json (migrate.agentic = ${JSON.stringify(
        value
      )}). Nx won't ask again.`,
    });
  } catch (e) {
    output.warn({
      title: `Could not save your agentic choice to nx.json: ${
        e instanceof Error ? e.message : String(e)
      }`,
    });
  }
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
    // The requested agent isn't installed. Rather than aborting the migration,
    // warn and fall through to resolve from the agents that ARE installed
    // (pick when 2+, auto-select the only one, error only when none exist).
    if (detected.length > 0) {
      output.warn({
        title: `The requested agent "${explicitId}" is not installed; using the installed agent(s) instead.`,
        bodyLines: [
          'Currently installed agents:',
          ...detected.map((d) => `  - ${d.displayName} (${d.id})`),
        ],
      });
    }
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

  // Blank line keeps the prompt from gluing to the preceding output.
  console.log();
  const response = await migratePrompt<{ id: AgentId }>({
    name: 'id',
    type: 'select',
    message: 'Multiple AI agents detected. Which one should Nx use?',
    choices: detected.map((d) => ({ name: d.id, message: d.displayName })),
  });
  reportMigratePrompt('agent_select', response.id);
  return detected.find((d) => d.id === response.id)!;
}
