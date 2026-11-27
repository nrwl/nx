import { homedir } from 'os';
import { join } from 'path';
import { lt, prerelease, valid } from 'semver';
import { parse as parseToml } from 'smol-toml';
import {
  AgentDefinition,
  HANDOFFS_DIR_NAME,
  MIGRATE_RUNS_RELATIVE_DIR,
  type VersionOutputReading,
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
 * The run directory names Nx will interpolate into a permission rule. Claude
 * Code reads a rule's path as a gitignore pattern, with `*?[]\` as syntax, and
 * Copilot CLI reads it as a glob. `--allowedTools` also splits its value on
 * commas and spaces, so a name carrying any of those would change what the
 * rule authorizes rather than what it names. The leading character rejects `.`
 * and `..`.
 */
const RULE_SAFE_RUN_DIR_NAME = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;

function runHandoffsPattern(runDirName: string): string | null {
  if (!RULE_SAFE_RUN_DIR_NAME.test(runDirName)) {
    return null;
  }
  return `${MIGRATE_RUNS_RELATIVE_DIR}/${runDirName}/${HANDOFFS_DIR_NAME}/**`;
}

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
  const pattern = runHandoffsPattern(runDirName);
  return pattern === null ? null : `Edit(${pattern})`;
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
  readVersionOutput: readOpencodeVersionOutput,
};

// Earlier 2.x releases can leave `--prompt` unsent, and a prerelease's version
// doesn't say whether it has the fix:
// https://github.com/anomalyco/opencode/pull/51938
const OPENCODE_2_MIN_VERSION = '2.0.19';

// 1.x prints a bare version and 2.x `opencode v<version>`. 2.x prereleases
// are versioned 0.0.0-*, so the shape tells the releases apart, not the number.
function readOpencodeVersionOutput(stdout: string): VersionOutputReading {
  const firstLine = stdout.split(/\r?\n/)[0].trim();
  if (firstLine.startsWith('opencode v')) {
    const version = firstLine.slice('opencode v'.length);
    if (!valid(version) || prerelease(version) !== null) {
      return {
        kind: 'unsupported',
        reason: `OpenCode ${version} is not a stable release, so Nx can't tell whether it sends its starting prompt; install a stable release of OpenCode, ${OPENCODE_2_MIN_VERSION} or later`,
      };
    }
    if (lt(version, OPENCODE_2_MIN_VERSION)) {
      return {
        kind: 'unsupported',
        reason: `OpenCode ${version} can leave its starting prompt unsent; update OpenCode to ${OPENCODE_2_MIN_VERSION} or later`,
      };
    }
    return { kind: 'launchable', details: { opencodeMajor: 2 } };
  }
  return /^\d+\.\d+\.\d+/.test(firstLine)
    ? { kind: 'launchable', details: { opencodeMajor: 1 } }
    : { kind: 'unrecognized' };
}

// --- GitHub Copilot CLI --------------------------------------------------

// The install script's default for a non-root user. On Windows the script
// installs through WinGet instead.
function copilotCliWellKnownPaths(): string[] {
  if (process.platform === 'win32') {
    return [];
  }
  return [join(homedir(), '.local', 'bin', 'copilot')];
}

/**
 * Pre-authorizes the handoff write, as {@link claudeCodeHandoffAllowedTools}
 * does for Claude Code. Copilot CLI matches a relative path by its trailing
 * segments, so the rule also admits this run's handoffs path nested anywhere
 * in the workspace, which nx never reads. An absolute path would put the
 * workspace path, glob syntax included, into the rule.
 */
export function copilotCliHandoffAllowTool(runDirName: string): string | null {
  const pattern = runHandoffsPattern(runDirName);
  return pattern === null ? null : `write(${pattern})`;
}

const copilotCliDefinition: AgentDefinition = {
  id: 'copilot',
  displayName: 'GitHub Copilot CLI',
  binaryNames: ['copilot'],
  wellKnownPaths: copilotCliWellKnownPaths,
  // AWS Copilot CLI also installs a `copilot` binary.
  readVersionOutput: (stdout) =>
    stdout.startsWith('GitHub Copilot CLI ')
      ? { kind: 'launchable', details: {} }
      : { kind: 'unrecognized' },
};

// --- Registry ------------------------------------------------------------

export const AGENT_DEFINITIONS: readonly AgentDefinition[] = [
  claudeCodeDefinition,
  codexDefinition,
  opencodeDefinition,
  copilotCliDefinition,
];
