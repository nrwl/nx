import { AgentDefinition, InvocationContext, InvocationSpec } from '../types';

function wellKnownPaths(): string[] {
  return [];
}

function buildInteractive(ctx: InvocationContext): InvocationSpec {
  return {
    args: ['-c', `developer_instructions=${ctx.systemContext}`, ctx.userPrompt],
    cwd: ctx.workspaceRoot,
  };
}

export const codexDefinition: AgentDefinition = {
  id: 'codex',
  displayName: 'OpenAI Codex',
  binaryNames: ['codex'],
  wellKnownPaths,
  buildInteractive,
};
