import { homedir } from 'os';
import { join } from 'path';
import { parse as parseToml } from 'smol-toml';
import {
  AgentDefinition,
  HANDOFFS_DIR_NAME,
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
 * would change what the rule authorizes rather than what it names. The
 * leading character rejects `.` and `..`.
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
 * session cwd, which every caller pins to the workspace root.
 *
 * Returns null for a name it cannot express, which costs the approval prompt
 * this exists to avoid. That beats widening the rule, and nothing narrower is
 * available: Claude Code has no escape for a literal path.
 */
export function claudeCodeHandoffAllowedTools(
  runDirName: string
): string | null {
  if (!RULE_SAFE_RUN_DIR_NAME.test(runDirName)) {
    return null;
  }
  return `Edit(${MIGRATE_RUNS_RELATIVE_DIR}/${runDirName}/${HANDOFFS_DIR_NAME}/**)`;
}

export const claudeCodeDefinition: AgentDefinition = {
  id: 'claude-code',
  displayName: 'Claude Code',
  binaryNames: ['claude'],
  wellKnownPaths: claudeCodeWellKnownPaths,
};

// --- OpenAI Codex --------------------------------------------------------

function codexWellKnownPaths(): string[] {
  return [];
}

/**
 * Encodes a single-line TOML string for codex overrides. Codex treats a parse
 * failure as literal text instead of reporting it, so the result is parsed
 * back before it reaches the command line.
 */
export function encodeTomlString(value: string): string {
  // JSON escapes every control TOML rejects except DEL, which it leaves raw.
  const encoded = JSON.stringify(value).replace(/\x7f/g, '\\u007F');
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

const codexDefinition: AgentDefinition = {
  id: 'codex',
  displayName: 'OpenAI Codex',
  binaryNames: ['codex'],
  wellKnownPaths: codexWellKnownPaths,
};

// --- OpenCode ------------------------------------------------------------

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

export const opencodeDefinition: AgentDefinition = {
  id: 'opencode',
  displayName: 'OpenCode',
  binaryNames: ['opencode'],
  wellKnownPaths: opencodeWellKnownPaths,
};

// --- Registry ------------------------------------------------------------

export const AGENT_DEFINITIONS: readonly AgentDefinition[] = [
  claudeCodeDefinition,
  codexDefinition,
  opencodeDefinition,
];
