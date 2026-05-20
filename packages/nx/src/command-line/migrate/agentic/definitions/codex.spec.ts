import { codexDefinition } from './codex';

describe('codexDefinition', () => {
  it('injects the system context via developer_instructions and appends the user prompt', () => {
    const spec = codexDefinition.buildInteractive({
      systemContext: 'system text',
      userPrompt: 'user text',
      workspaceRoot: '/workspace',
    });
    expect(spec).toEqual({
      args: ['-c', 'developer_instructions=system text', 'user text'],
      cwd: '/workspace',
    });
  });
});
