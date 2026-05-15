import { homedir } from 'os';
import { join } from 'path';
import { AgentDefinition, InvocationContext, InvocationSpec } from '../types';

const TRANSIENT_AGENT_NAME = 'nx-migrate';

function wellKnownPaths(): string[] {
  if (process.platform === 'win32') {
    // Windows install paths for OpenCode haven't been verified yet; rely on
    // PATH detection for now.
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

function buildInteractive(ctx: InvocationContext): InvocationSpec {
  const config = {
    agent: {
      [TRANSIENT_AGENT_NAME]: { prompt: ctx.systemContext },
    },
  };
  return {
    args: ['--agent', TRANSIENT_AGENT_NAME, '--prompt', ctx.userPrompt],
    env: { OPENCODE_CONFIG_CONTENT: JSON.stringify(config) },
    cwd: ctx.workspaceRoot,
  };
}

export const opencodeDefinition: AgentDefinition = {
  id: 'opencode',
  displayName: 'OpenCode',
  binaryNames: ['opencode'],
  wellKnownPaths,
  buildInteractive,
};
