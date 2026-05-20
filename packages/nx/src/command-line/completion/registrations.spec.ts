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
    // First positional must complete BOTH project:target tokens AND the
    // inputs/outputs keywords — `nx show target i<TAB>` should land on
    // `inputs`/`outputs` even though no project starts with `i`.
    const firstCompleter = target?.metadata.positionals?.[0]?.complete;
    expect(firstCompleter).toBeInstanceOf(Function);
    expect(firstCompleter?.('i', ['show', 'target', 'i'])).toEqual(
      expect.arrayContaining(['inputs'])
    );
  });

  it('registers `show target inputs` and `show target outputs`', () => {
    // After the keyword is typed, the next positional completes
    // project:target — `nx show target inputs <TAB>` lists projects.
    expect(findCompletionMetadata(['show', 'target', 'inputs'])).not.toBeNull();
    expect(
      findCompletionMetadata(['show', 'target', 'outputs'])
    ).not.toBeNull();
  });

  it('registers `add` with first-party plugin suggestions', () => {
    const match = findCompletionMetadata(['add']);
    const complete = match?.metadata.positionals?.[0]?.complete;
    expect(complete).toBeInstanceOf(Function);
    // Prefix-filtered: typing `@nx/r` lands on the rspack/react/etc. set.
    const results = complete?.('@nx/r', ['add', '@nx/r']) ?? [];
    expect(results).toEqual(
      expect.arrayContaining(['@nx/react', '@nx/rspack'])
    );
    expect(results.every((r) => r.startsWith('@nx/r'))).toBe(true);
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
