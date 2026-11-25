import { existsSync, readFileSync, writeFileSync } from 'fs';
import { applyEdits, modify } from 'jsonc-parser';
import { join } from 'path';
import { IS_WASM } from '../../../native';
import { output } from '../../../utils/output';
import { workspaceRoot } from '../../../utils/workspace-root';
import {
  type MigratePromptChoices,
  reportMigratePrompt,
} from '../migrate-analytics';
import type { MigrationIdProblem } from '../run';
import { migrateChoice } from '../safe-prompt';
import { singleLine } from '../text';
import {
  confirmAgentIdentity,
  detectInstalledAgents,
  type RejectedAgentBinary,
} from './detect-installed';
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
 * Callers resolve this once per run-phase invocation and reuse the result for
 * every migration it covers.
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

  // Skip detection where its result is unused: explicit `--agentic=false`,
  // and any non-interactive run, since the agent session needs a terminal.
  if (input.agentic === false) {
    return { kind: 'disabled' };
  }
  if (!isInteractive) {
    if (input.agentic !== undefined) {
      warnAgenticInteractiveOnly();
    }
    return { kind: 'disabled' };
  }

  const detected = await detectInstalledAgents(AGENT_DEFINITIONS);
  const { enabled, explicitId, persist } = await resolveFlag(input, detected);

  if (!enabled) {
    if (persist === false) {
      persistAgenticChoice(false);
    }
    return { kind: 'disabled' };
  }

  const identified = await keepIdentifiedAgents(detected, explicitId);
  // Only the up-front prompt enables the flow with `agentic` unset. Saying yes
  // there must not stop the migration, so it continues without an agent.
  if (input.agentic === undefined && identified.agents.length === 0) {
    output.warn({
      title:
        'Continuing without the agentic flow: no installed AI agent could be used.',
      bodyLines: [
        ...identified.rejected.flatMap(rejectedBinaryLines),
        'Generators still run, prompt-based changes are left for you to apply, and no AI validation runs.',
      ],
    });
    return { kind: 'disabled' };
  }

  const selected = await selectAgent(
    identified.agents,
    explicitId,
    identified.rejected
  );

  if (persist === true) {
    persistAgenticChoice(true);
  } else if (persist === 'pin') {
    persistAgenticChoice(selected.id);
  }

  return { kind: 'enabled', selectedAgent: selected };
}

const ID_PROBLEM_LABELS: Record<MigrationIdProblem, string> = {
  'not-shell-safe': 'not shell-safe',
  duplicate: 'listed more than once',
};

export function idProblemLines(
  problems: ReadonlyArray<{ id: string; problem: MigrationIdProblem }>
): string[] {
  return problems.map(
    ({ id, problem }) => `- ${singleLine(id)} (${ID_PROBLEM_LABELS[problem]})`
  );
}

/**
 * Drops an enabled agent, with a warning, where the orchestrator that drives
 * it cannot run: under the WASM build, and for migration ids an orchestrated
 * run cannot take.
 */
export function dropUnsupportedAgent(
  agentic: ResolvedAgentic,
  idProblems: ReadonlyArray<{ id: string; problem: MigrationIdProblem }>
): ResolvedAgentic {
  if (agentic.kind !== 'enabled') return agentic;
  if (IS_WASM) {
    output.warn({
      title:
        'Skipping the agentic flow: it needs the native nx binary, and this run loaded the WASM build.',
      bodyLines: ['Continuing the migration without the agentic flow.'],
    });
    return { kind: 'disabled' };
  }
  if (idProblems.length > 0) {
    output.warn({
      title:
        'Skipping the agentic flow: it needs each migration id to be shell-safe (letters, digits and @/:._-) and listed once, and these are not:',
      bodyLines: [
        ...idProblemLines(idProblems),
        'Continuing the migration without the agentic flow. Generators still run. Prompt-only migrations and the prompt part of hybrid migrations are skipped and listed as next steps, and no AI validation runs.',
      ],
    });
    return { kind: 'disabled' };
  }
  return agentic;
}

/**
 * What to persist to `nx.json` `migrate.agentic` after the up-front prompt:
 * `undefined` = don't persist, `false` = persist disabled, `true` = persist
 * enabled (resolve the agent each run), `'pin'` = persist the selected agent id.
 */
type PersistChoice = undefined | boolean | 'pin';

async function resolveFlag(
  input: ResolveAgenticInput,
  detected: DetectedInstalledAgent[]
): Promise<{
  enabled: boolean;
  explicitId?: AgentId;
  persist?: PersistChoice;
}> {
  if (input.agentic === true) {
    return { enabled: true };
  }
  if (typeof input.agentic === 'string') {
    return { enabled: true, explicitId: input.agentic };
  }
  // undefined: fire the up-front prompt only when something agentic-eligible
  // is queued and at least one agent is installed. Without an installed agent
  // the user can't say "Yes" meaningfully, so asking would walk them into a
  // dead end.
  if (!input.migrations.some((m) => !!m.prompt)) {
    return { enabled: false };
  }
  if (detected.length === 0) {
    return { enabled: false };
  }
  return firePromptForAgentic(input.migrations, detected);
}

function warnAgenticInteractiveOnly(): void {
  output.warn({
    title:
      'Skipping the agentic flow: the agent session needs an interactive terminal, and this run is non-interactive.',
    bodyLines: [
      'Continuing without the agentic flow. Generators still run, prompt-based changes are left for you to apply, and no AI validation runs. Re-run in an interactive terminal to use the agentic flow.',
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
  // `name` is typed so renaming a choice here fails to compile instead of
  // silently forking the GA value-space and falling through the switch below.
  type AgenticChoice = {
    value: MigratePromptChoices['agentic'];
    label: string;
    hint: string;
  };
  const pinChoice: AgenticChoice[] = multipleAgents
    ? [
        {
          value: 'yes-pin',
          label: 'Yes, always with the same agent',
          hint: rememberHint,
        },
      ]
    : [];
  const choices: AgenticChoice[] = [
    {
      value: 'yes-once',
      label: 'Yes, just this time',
      hint: applyHint,
    },
    {
      value: 'yes-flex',
      label: multipleAgents
        ? "Yes, always (I'll pick the agent each run)"
        : 'Yes, always',
      hint: rememberHint,
    },
    ...pinChoice,
    { value: 'no-once', label: 'No, just this time', hint: skipHint },
    { value: 'no-never', label: 'No, never', hint: rememberHint },
  ];

  // Blank line keeps the prompt from gluing to the previous `npm install`
  // output or any earlier orchestrator line.
  console.log();
  // Each choice's hint renders beside it, so the description no longer needs a
  // footer that tracks the cursor.
  const choice = await migrateChoice<MigratePromptChoices['agentic']>({
    message: 'Enable the agentic flow?',
    choices,
  });

  reportMigratePrompt('agentic', choice);

  switch (choice) {
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

interface IdentifiedAgents {
  agents: DetectedInstalledAgent[];
  rejected: {
    agent: DetectedInstalledAgent;
    binaries: RejectedAgentBinary[];
  }[];
}

// Runs once the flow is enabled, since confirming an agent can execute every
// binary that carries its name. A usable requested agent is the only one
// selection reads, so the others are not confirmed.
async function keepIdentifiedAgents(
  detected: DetectedInstalledAgent[],
  explicitId: AgentId | undefined
): Promise<IdentifiedAgents> {
  const rejected: IdentifiedAgents['rejected'] = [];
  const identify = async (agent: DetectedInstalledAgent) => {
    const definition = AGENT_DEFINITIONS.find((d) => d.id === agent.id)!;
    const identity = await confirmAgentIdentity(definition, agent);
    if (identity.kind === 'confirmed') {
      return identity.agent;
    }
    rejected.push({ agent, binaries: identity.binaries });
    return null;
  };

  const requested = detected.find((d) => d.id === explicitId);
  if (requested) {
    const agent = await identify(requested);
    if (agent) {
      return { agents: [agent], rejected };
    }
  }
  const agents: DetectedInstalledAgent[] = [];
  for (const candidate of detected) {
    if (candidate === requested) {
      continue;
    }
    const agent = await identify(candidate);
    if (agent) {
      agents.push(agent);
    }
  }
  return { agents, rejected };
}

function rejectedBinaryLines({
  agent,
  binaries,
}: IdentifiedAgents['rejected'][number]): string[] {
  return binaries.map(
    ({ binary, reason }) =>
      `  - ${binary} is not ${agent.displayName}: ${reason}`
  );
}

async function selectAgent(
  detected: DetectedInstalledAgent[],
  explicitId: AgentId | undefined,
  rejected: IdentifiedAgents['rejected']
): Promise<DetectedInstalledAgent> {
  if (explicitId) {
    const match = detected.find((d) => d.id === explicitId);
    if (match) {
      return match;
    }
    // The requested agent isn't installed or can't be used. Rather than
    // aborting the migration, warn and fall through to resolve from the agents
    // that ARE installed (pick when 2+, auto-select the only one, error only
    // when none exist).
    const installedLines = [
      'Currently installed agents:',
      ...detected.map((d) => `  - ${d.displayName} (${d.id})`),
    ];
    const rejection = rejected.find((r) => r.agent.id === explicitId);
    if (rejection) {
      output.warn({
        title:
          detected.length > 0
            ? `The requested agent "${explicitId}" could not be used; using the installed agent(s) instead.`
            : `The requested agent "${explicitId}" could not be used.`,
        bodyLines: [
          ...rejectedBinaryLines(rejection),
          ...(detected.length > 0 ? installedLines : []),
        ],
      });
    } else if (detected.length > 0) {
      output.warn({
        title: `The requested agent "${explicitId}" is not installed; using the installed agent(s) instead.`,
        bodyLines: installedLines,
      });
    }
  }

  if (detected.length === 0) {
    const unshownRejections = rejected.filter((r) => r.agent.id !== explicitId);
    output.error({
      title:
        rejected.length > 0
          ? 'Agentic flow was enabled, but no installed AI agent could be used.'
          : 'Agentic flow was enabled, but no supported AI agent is installed on this machine.',
      bodyLines: [
        ...unshownRejections.flatMap(rejectedBinaryLines),
        ...INSTALL_SUPPORTED_AGENTS_HINT,
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

  // Blank line keeps the prompt from gluing to the preceding output.
  console.log();
  const id = await migrateChoice<AgentId>({
    message: 'Multiple AI agents detected. Which one should Nx use?',
    choices: detected.map((d) => ({ value: d.id, label: d.displayName })),
  });
  reportMigratePrompt('agent_select', id);
  return detected.find((d) => d.id === id)!;
}
