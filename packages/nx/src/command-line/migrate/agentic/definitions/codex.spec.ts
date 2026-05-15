import { codexDefinition } from './codex';

describe('codexDefinition', () => {
  it('uses the expected id, display name, and binary name', () => {
    expect(codexDefinition.id).toBe('codex');
    expect(codexDefinition.displayName).toBe('OpenAI Codex');
    expect(codexDefinition.binaryNames).toEqual(['codex']);
  });

  it('returns no well-known paths (PATH only)', () => {
    expect(codexDefinition.wellKnownPaths()).toEqual([]);
  });

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
