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

  // Round-trip guard: argv flows verbatim to the spawned process, so even
  // hostile workspace paths / migration ids embedded in the system context
  // must reach codex untouched. If we ever add shell-style escaping here,
  // these assertions catch the regression.
  it.each([
    ['embedded newlines', 'line1\nline2'],
    ['equals signs', 'key1=val1\nkey2=val2'],
    ['double quotes', 'workspace at "/Users/me/work"'],
    ['angle brackets', 'before <script>after'],
    ['ampersands', 'a && b'],
    ['backticks and dollars', '`whoami` $HOME'],
    ['null-ish unicode', 'safe​text'],
    ['windows-style path', 'C:\\Users\\me\\My Documents\\ws'],
  ])(
    'preserves hostile system context verbatim through buildInteractive (%s)',
    (_label, hostile) => {
      const spec = codexDefinition.buildInteractive({
        systemContext: hostile,
        userPrompt: 'user',
        workspaceRoot: '/ws',
      });
      expect(spec.args).toEqual([
        '-c',
        `developer_instructions=${hostile}`,
        'user',
      ]);
    }
  );
});
