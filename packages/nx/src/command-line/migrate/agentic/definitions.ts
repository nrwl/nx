import { homedir } from 'os';
import { join } from 'path';
import { parse as parseToml } from 'smol-toml';
import {
  AgentDefinition,
  AgentId,
  HANDOFFS_DIR_NAME,
  InvocationContext,
  InvocationSpec,
  MIGRATE_RUNS_RELATIVE_DIR,
} from './types';

// --- Claude Code ---------------------------------------------------------

function claudeCodeWellKnownPaths(): string[] {
  if (process.platform === 'win32') {
    const home = process.env.USERPROFILE;
    return home ? [join(home, '.local', 'bin', 'claude.exe')] : [];
  }
  return [join(homedir(), '.claude', 'local', 'claude')];
}

/**
 * The run directory names Nx will interpolate into a permission rule. A rule
 * is a gitignore pattern, which reads `*?[]\` as syntax, and `--allowedTools`
 * splits its value on commas and spaces, so a name carrying any of those
 * would change what the rule authorizes rather than what it names. Run
 * directory names derive from a migration's own version string, which nothing
 * upstream constrains to this alphabet. The leading character rejects `.`
 * and `..`.
 */
const RULE_SAFE_RUN_DIR_NAME = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;

/**
 * Pre-authorizes the handoff write. Claude Code's default permission mode
 * asks before a file write it has no allow rule for, so without this every
 * step ends on an approval prompt for Nx's own handoff scratch.
 *
 * The rule reaches one run's handoffs and nothing else. Its own run
 * directory also holds state Nx wrote and reads back, and the sibling
 * directories belong to other runs, including an orchestrated run whose
 * handoffs decide how its steps settle. `Edit` is the only tool name file
 * rules are matched against, and it covers creating the file as well as
 * correcting one already written. Prefix-less patterns resolve against the
 * session cwd, pinned to the workspace root below.
 *
 * Returns null for a name it cannot express, which costs the approval prompt
 * this exists to avoid. That beats widening the rule, and nothing narrower is
 * available: Claude Code has no escape for a literal path.
 */
function claudeCodeHandoffAllowedTools(runDirName: string): string | null {
  if (!RULE_SAFE_RUN_DIR_NAME.test(runDirName)) {
    return null;
  }
  return `Edit(${MIGRATE_RUNS_RELATIVE_DIR}/${runDirName}/${HANDOFFS_DIR_NAME}/**)`;
}

// `--system-prompt-file` rather than `--system-prompt`: the prompt is several
// kilobytes of multi-line text and would not survive the `cmd.exe` shim on
// Windows. Claude Code has accepted the flag since 1.0.55 (2025-07-17) and
// errors out loudly on an older build rather than silently dropping it.
function claudeCodeBuildInteractive(ctx: InvocationContext): InvocationSpec {
  const allowedTools = claudeCodeHandoffAllowedTools(ctx.runDirName);
  return {
    // `--allowedTools` is variadic (space/comma separated): a positional
    // placed right after its value gets swallowed as another rule. The rules
    // must stay in one comma-joined element with a non-variadic flag
    // (`--system-prompt-file`) between them and the instructions pointer.
    args: [
      ...(allowedTools ? ['--allowedTools', allowedTools] : []),
      '--system-prompt-file',
      ctx.systemPromptFilePath,
      ctx.instructionsPointer,
    ],
    cwd: ctx.workspaceRoot,
  };
}

export const claudeCodeDefinition: AgentDefinition = {
  id: 'claude-code',
  displayName: 'Claude Code',
  binaryNames: ['claude'],
  wellKnownPaths: claudeCodeWellKnownPaths,
  buildInteractive: claudeCodeBuildInteractive,
};

// --- OpenAI Codex --------------------------------------------------------

function codexWellKnownPaths(): string[] {
  return [];
}

// No handoff permission flag: codex's default sandbox already allows writes
// inside the cwd tree without prompting, and a user-hardened read-only config
// is a deliberate choice we don't override.
//
// codex has no flag for loading instructions from a file (`-c
// model_instructions_file` replaces its base instructions and its own docs
// discourage it), so its system context is the one that stays on the command
// line, hence the reduced `inlineSystemContext` rather than the full prompt.
function codexBuildInteractive(ctx: InvocationContext): InvocationSpec {
  return {
    args: [
      '-c',
      `developer_instructions=${encodeTomlString(ctx.inlineSystemContext)}`,
      ctx.instructionsPointer,
    ],
    cwd: ctx.workspaceRoot,
  };
}

/**
 * Encodes a value for a codex `-c key=value` override as a TOML basic string.
 *
 * codex parses the value as TOML and, when the parse fails, silently falls
 * back to the raw text with surrounding quotes trimmed, so a bad encoding
 * would ship a mangled system context with no error anywhere. Round-tripping
 * through a real TOML parser turns that into a thrown error instead.
 *
 * `JSON.stringify` produces the encoding: every escape it emits (`\"`, `\\`,
 * `\n`, `\r`, `\t`, `\b`, `\f`, `\uXXXX`) is also a TOML basic-string escape,
 * and the one JSON escape TOML lacks (`\/`) is never emitted. That covers what
 * JSON escapes, not what it leaves raw, and the characters it leaves raw
 * include control characters TOML rejects in a basic string. Catching those is
 * what the round-trip is for. Its single-line output matters too: a TOML
 * multi-line string would put raw newlines back on the command line, which a
 * `.cmd` shim cannot carry.
 */
function encodeTomlString(value: string): string {
  const encoded = JSON.stringify(value);
  let decoded: unknown;
  try {
    decoded = (parseToml(`value = ${encoded}`) as { value: unknown }).value;
  } catch (err) {
    throw new Error(
      `Could not encode the agent's system context as TOML for OpenAI Codex: ${
        err instanceof Error ? err.message : String(err)
      }`,
      { cause: err }
    );
  }
  if (decoded !== value) {
    throw new Error(
      `Encoding the agent's system context as TOML for OpenAI Codex did not round-trip; refusing to run the agent on altered instructions.`
    );
  }
  return encoded;
}

export const codexDefinition: AgentDefinition = {
  id: 'codex',
  displayName: 'OpenAI Codex',
  binaryNames: ['codex'],
  wellKnownPaths: codexWellKnownPaths,
  buildInteractive: codexBuildInteractive,
};

// --- OpenCode ------------------------------------------------------------

const OPENCODE_TRANSIENT_AGENT_NAME = 'nx-migrate';

function opencodeWellKnownPaths(): string[] {
  if (process.platform === 'win32') {
    return [];
  }
  const candidates: string[] = [];
  const home = homedir();
  const installDir = process.env.OPENCODE_INSTALL_DIR;
  const xdgBinDir = process.env.XDG_BIN_DIR;
  if (installDir) {
    candidates.push(join(installDir, 'opencode'));
  }
  if (xdgBinDir) {
    candidates.push(join(xdgBinDir, 'opencode'));
  }
  candidates.push(join(home, 'bin', 'opencode'));
  candidates.push(join(home, '.opencode', 'bin', 'opencode'));
  return candidates;
}

// No handoff permission config: opencode's `edit` permission defaults to
// allow, and injecting one would clobber (not merge with) a user's own
// permission patterns.
//
// The config keeps travelling through OPENCODE_CONFIG_CONTENT rather than
// OPENCODE_CONFIG: both are merged with the user's own config, but the runner
// spreads `env` over `process.env`, so naming OPENCODE_CONFIG here would
// silently overwrite one the user had set.
function opencodeBuildInteractive(ctx: InvocationContext): InvocationSpec {
  const config = {
    agent: {
      [OPENCODE_TRANSIENT_AGENT_NAME]: { prompt: opencodeSystemPrompt(ctx) },
    },
  };
  return {
    args: [
      '--agent',
      OPENCODE_TRANSIENT_AGENT_NAME,
      '--prompt',
      ctx.instructionsPointer,
    ],
    env: { OPENCODE_CONFIG_CONTENT: JSON.stringify(config) },
    cwd: ctx.workspaceRoot,
  };
}

/**
 * opencode substitutes `{file:<path>}` with the file's contents before parsing
 * the config, which keeps the system prompt out of the environment block.
 * cmd.exe drops any inherited variable longer than 8191 characters.
 *
 * The substitution ends at the first `}`, so a path containing one would name
 * a file that does not exist. That case inlines the prompt instead, which is
 * what shipped before. Only the system prompt is ever inlined, never the
 * instructions, so the value is bounded by the prompt's own size rather than by
 * the generator's output; `windows-command-line.spec.ts` holds it against the
 * 8191-character limit, which the runner's own budget check cannot see.
 */
function opencodeSystemPrompt(ctx: InvocationContext): string {
  // Forward slashes so the value opencode substitutes on carries no
  // backslash-escaping question of its own.
  const filePath = ctx.systemPromptFilePath.replace(/\\/g, '/');
  return filePath.includes('}') ? ctx.systemPrompt : `{file:${filePath}}`;
}

export const opencodeDefinition: AgentDefinition = {
  id: 'opencode',
  displayName: 'OpenCode',
  binaryNames: ['opencode'],
  wellKnownPaths: opencodeWellKnownPaths,
  buildInteractive: opencodeBuildInteractive,
};

// --- Registry ------------------------------------------------------------

export const AGENT_DEFINITIONS: readonly AgentDefinition[] = [
  claudeCodeDefinition,
  codexDefinition,
  opencodeDefinition,
];

const byId = new Map<AgentId, AgentDefinition>(
  AGENT_DEFINITIONS.map((definition) => [definition.id, definition])
);

export function getAgentDefinition(id: AgentId): AgentDefinition | undefined {
  return byId.get(id);
}
