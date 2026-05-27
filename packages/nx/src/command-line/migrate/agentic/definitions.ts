import { homedir } from 'os';
import { join } from 'path';
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

function claudeCodeBuildInteractive(ctx: InvocationContext): InvocationSpec {
  return {
    args: ['--system-prompt', ctx.systemContext, ctx.userPrompt],
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
