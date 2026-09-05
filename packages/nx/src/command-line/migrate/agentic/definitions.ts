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

// The prompt is kilobytes of multi-line text, which a `cmd.exe` shim cannot
// carry as an argument.
function claudeCodeBuildInteractive(ctx: InvocationContext): InvocationSpec {
  const allowedTools = claudeCodeHandoffAllowedTools(ctx.runDirName);
  return {
    // `--allowedTools` is variadic, so a positional right after it is read as
    // another rule: keep the rules in one comma-joined element and a flag
    // between them and the instructions pointer.
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
// inside the cwd tree, and a user-hardened read-only config is theirs to keep.
//
// `-c model_instructions_file` replaces codex's built-in instructions rather
// than adding this context to them, so the context stays on the command line,
// reduced rather than the full prompt.
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
 * codex falls back to the raw text as a literal when the value does not parse
 * as TOML, so a bad encoding ships a mangled system context with no error. The
 * escapes `JSON.stringify` emits are all TOML basic-string escapes, but the
 * characters it leaves raw include control characters TOML rejects, which is
 * what the round-trip catches. Single-line output is required too: a TOML
 * multi-line string would put raw newlines back on the command line.
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
// allow, and injecting one would clobber a user's own patterns rather than
// merge with them.
//
// The config travels through OPENCODE_CONFIG_CONTENT rather than
// OPENCODE_CONFIG. Both merge with the user's own config, but the runner
// spreads `env` over `process.env`, so the latter would overwrite a value the
// user had set.
function opencodeBuildInteractive(ctx: InvocationContext): InvocationSpec {
  return {
    args: [
      '--agent',
      OPENCODE_TRANSIENT_AGENT_NAME,
      '--prompt',
      ctx.instructionsPointer,
    ],
    env: { OPENCODE_CONFIG_CONTENT: opencodeConfigContent(ctx) },
    cwd: ctx.workspaceRoot,
  };
}

/**
 * opencode expands `{env:<name>}` and then `{file:<path>}` over the raw config
 * text and parses the JSON afterwards, so this is a substitution template, not
 * a document. The file reference keeps the prompt out of the environment,
 * where cmd.exe drops any inherited variable over 8191 characters, and the
 * prompt it falls back to inlining carries no pattern opencode can expand.
 *
 * The instructions are never inlined, so the value is bounded by the prompt
 * rather than the generator's output, and `windows-command-line.spec.ts` holds
 * it against 8191 where the runner's own budget check cannot see it.
 */
function opencodeConfigContent(ctx: InvocationContext): string {
  // Windows separators become `/`, which its APIs accept just as well.
  // Elsewhere a `\` belongs to the file name.
  const filePath =
    process.platform === 'win32'
      ? ctx.systemPromptFilePath.replace(/\\/g, '/')
      : ctx.systemPromptFilePath;
  const prompt = isSubstitutionSafePath(filePath)
    ? JSON.stringify(`{file:${filePath}}`)
    : // `\u007b` starts no pattern and JSON decodes it back to `{`, so the
      // prompt survives expansion whatever the workspace path put in it.
      JSON.stringify(ctx.systemPrompt).replace(/\{/g, '\\u007b');
  // Assembled rather than serialized whole: `JSON.stringify` over the object
  // would re-escape the backslashes the `\u007b` encoding introduced.
  return `{"agent":{${JSON.stringify(
    OPENCODE_TRANSIENT_AGENT_NAME
  )}:{"prompt":${prompt}}}}`;
}

/**
 * Whether opencode would read back the path nx wrote. A `}` closes the
 * reference early, and a character JSON escapes arrives escaped. Braces are
 * rejected wholesale rather than matched against `{env:` and `{file:`, since a
 * pattern opening inside the path swallows the reference's closing brace.
 */
function isSubstitutionSafePath(filePath: string): boolean {
  return (
    !/[{}]/.test(filePath) && JSON.stringify(filePath).slice(1, -1) === filePath
  );
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
