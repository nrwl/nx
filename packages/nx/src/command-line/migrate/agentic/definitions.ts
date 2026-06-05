import { homedir } from 'os';
import { join } from 'path';
import { MIGRATE_RUNS_RELATIVE_DIR } from './handoff';
import {
  AgentDefinition,
  AgentId,
  InvocationContext,
  InvocationSpec,
} from './types';

// --- Claude Code ---------------------------------------------------------

function claudeCodeWellKnownPaths(): string[] {
  if (process.platform === 'win32') {
    const home = process.env.USERPROFILE;
    return home ? [join(home, '.local', 'bin', 'claude.exe')] : [];
  }
  return [join(homedir(), '.claude', 'local', 'claude')];
}

// Pre-authorizes the handoff write: Claude Code's default permission mode
// asks before file writes it has no allow rule for, so without this each step
// ends with an approval prompt for nx's own handoff scratch. Prefix-less
// patterns resolve against the session cwd (pinned to the workspace root
// below); `Edit` covers corrections to an already-written handoff.
const CLAUDE_CODE_HANDOFF_ALLOWED_TOOLS = `Write(${MIGRATE_RUNS_RELATIVE_DIR}/**),Edit(${MIGRATE_RUNS_RELATIVE_DIR}/**)`;

function claudeCodeBuildInteractive(ctx: InvocationContext): InvocationSpec {
  return {
    // `--allowedTools` is variadic (space/comma separated): a positional
    // placed right after its value gets swallowed as another rule. The rules
    // must stay in one comma-joined element with a non-variadic flag
    // (`--system-prompt`) between them and the user prompt.
    args: [
      '--allowedTools',
      CLAUDE_CODE_HANDOFF_ALLOWED_TOOLS,
      '--system-prompt',
      ctx.systemContext,
      ctx.userPrompt,
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
function codexBuildInteractive(ctx: InvocationContext): InvocationSpec {
  return {
    args: ['-c', `developer_instructions=${ctx.systemContext}`, ctx.userPrompt],
    cwd: ctx.workspaceRoot,
  };
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
function opencodeBuildInteractive(ctx: InvocationContext): InvocationSpec {
  const config = {
    agent: {
      [OPENCODE_TRANSIENT_AGENT_NAME]: { prompt: ctx.systemContext },
    },
  };
  return {
    args: [
      '--agent',
      OPENCODE_TRANSIENT_AGENT_NAME,
      '--prompt',
      ctx.userPrompt,
    ],
    env: { OPENCODE_CONFIG_CONTENT: JSON.stringify(config) },
    cwd: ctx.workspaceRoot,
  };
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
