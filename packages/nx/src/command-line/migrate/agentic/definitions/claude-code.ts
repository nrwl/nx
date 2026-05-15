import { homedir } from 'os';
import { join } from 'path';
import { AgentDefinition, InvocationContext, InvocationSpec } from '../types';

function wellKnownPaths(): string[] {
  if (process.platform === 'win32') {
    const home = process.env.USERPROFILE;
    return home ? [join(home, '.local', 'bin', 'claude.exe')] : [];
  }
  return [join(homedir(), '.claude', 'local', 'claude')];
}

function buildInteractive(ctx: InvocationContext): InvocationSpec {
  return {
    args: ['--system-prompt', ctx.systemContext, ctx.userPrompt],
    cwd: ctx.workspaceRoot,
  };
}

export const claudeCodeDefinition: AgentDefinition = {
  id: 'claude-code',
  displayName: 'Claude Code',
  binaryNames: ['claude'],
  wellKnownPaths,
  buildInteractive,
};
