import './registrations';
import { findCompletionMetadata, findFlagCompletion } from './metadata';

// Locks down the hand-maintained registrations. A dropped flag alias (e.g.
// removing `p` from run-many) or a missing positional completer silently
// disables completion for that form — these assertions catch it.

describe('completion/registrations', () => {
  it('registers `run` with a positional completer', () => {
    const match = findCompletionMetadata(['run']);
    expect(match?.metadata.positionals?.[0]?.complete).toBeInstanceOf(Function);
  });

  it('registers `generate` and its `g` alias', () => {
    expect(findCompletionMetadata(['generate'])).not.toBeNull();
    expect(findCompletionMetadata(['g'])).not.toBeNull();
  });

  it('registers `show project` and `show target`', () => {
    expect(findCompletionMetadata(['show', 'project'])).not.toBeNull();
    const target = findCompletionMetadata(['show', 'target']);
    expect(target?.metadata.positionals).toHaveLength(2);
  });

  it.each([
    'build',
    'serve',
    'test',
    'lint',
    'e2e',
    'dev',
    'start',
    'preview',
    'typecheck',
  ])('registers the infix target `%s`', (target) => {
    expect(findCompletionMetadata([target])).not.toBeNull();
  });

  // Each row lists every flag (canonical + alias) the command should
  // value-complete. findFlagCompletion must resolve a handler for all of them.
  it.each([
    ['run-many', ['projects', 'p', 'targets', 'target', 't']],
    ['affected', ['projects', 'p', 'targets', 'target', 't', 'exclude']],
    ['graph', ['focus', 'exclude', 'targets', 'target', 't']],
    ['watch', ['projects', 'p']],
  ] as const)('%s resolves a handler for every declared flag', (cmd, flags) => {
    const match = findCompletionMetadata([cmd]);
    expect(match).not.toBeNull();
    for (const flag of flags) {
      expect(findFlagCompletion(match!.metadata, flag)).toBeInstanceOf(
        Function
      );
    }
  });
});
