import yargs = require('yargs');
import { rewriteTargetsAndProjects } from '../../../bin/init-local';
import { yargsWatchCommand } from './command-object';

describe('watch command-object argument parsing', () => {
  // Run the real command builder (parserConfiguration, checks, and the
  // `--`->command middleware) but capture the parsed argv instead of importing
  // and running watch.js, so we exercise the actual parse pipeline.
  function parse(args: string[]): Record<string, any> {
    let parsed: any;
    yargs(args)
      .command({
        ...yargsWatchCommand,
        handler: (a) => {
          parsed = a;
        },
      })
      .parse();
    return parsed;
  }

  it('collects space-delimited --includeFiles values into an array', () => {
    const parsed = parse([
      'watch',
      '--all',
      '--includeFiles',
      'a',
      'b',
      '--',
      'echo',
      'hi',
    ]);
    expect(parsed.includeFiles).toEqual(['a', 'b']);
  });

  it('accepts the kebab-case --include-files spelling', () => {
    // The option is declared camelCase, like its `includeGlobalWorkspaceFiles`
    // and `includeDependencies` siblings, and yargs' camel-case expansion is
    // what makes the kebab spelling work. `strip-dashed` then drops the
    // dashed key, so only `includeFiles` reaches the handler either way.
    const parsed = parse([
      'watch',
      '--all',
      '--include-files',
      'a',
      'b',
      '--',
      'echo',
      'hi',
    ]);
    expect(parsed.includeFiles).toEqual(['a', 'b']);
    expect(parsed['include-files']).toBeUndefined();
  });

  it('collects repeated --includeFiles flags into an array of strings', () => {
    const parsed = parse([
      'watch',
      '--all',
      '--includeFiles',
      '2024',
      '--includeFiles',
      'b',
      '--',
      'echo',
      'hi',
    ]);
    // The numeric-looking value is what makes this a real guard: yargs collects
    // repeated flags into an array all on its own, so the array part alone
    // would pass with the option declaration deleted. `string: true` is what
    // keeps `2024` from arriving as the number 2024 and blowing up in
    // `new Minimatch`.
    expect(parsed.includeFiles).toEqual(['2024', 'b']);
  });

  it('collects space-delimited --excludeFiles values into an array', () => {
    const parsed = parse([
      'watch',
      '--all',
      '--excludeFiles',
      'a',
      'b',
      '--',
      'echo',
      'hi',
    ]);
    expect(parsed.excludeFiles).toEqual(['a', 'b']);
  });

  it('accepts the kebab-case --exclude-files spelling', () => {
    const parsed = parse([
      'watch',
      '--all',
      '--exclude-files',
      'a',
      'b',
      '--',
      'echo',
      'hi',
    ]);
    expect(parsed.excludeFiles).toEqual(['a', 'b']);
    expect(parsed['exclude-files']).toBeUndefined();
  });

  it('does not bind bare --include/--exclude to the file filters', () => {
    // `nx watch` deliberately does not spell these `--include`/`--exclude`:
    // the workspace-wide `--exclude` that `run-many`/`affected` take is a
    // comma-separated list of *project names*, so the same spelling here
    // would read as that and silently filter nothing. They are undeclared,
    // so yargs leaves them as loose values that never reach the glob filter.
    const parsed = parse([
      'watch',
      '--all',
      '--include',
      'a',
      '--exclude',
      'b',
      '--',
      'echo',
      'hi',
    ]);
    expect(parsed.includeFiles).toBeUndefined();
    expect(parsed.excludeFiles).toBeUndefined();
  });

  it('keeps a brace glob intact without splitting on the comma', () => {
    const parsed = parse([
      'watch',
      '--all',
      '--includeFiles',
      '**/*.{ts,tsx}',
      '--',
      'echo',
      'hi',
    ]);
    expect(parsed.includeFiles).toEqual(['**/*.{ts,tsx}']);
  });

  it('does not swallow the trailing -- command into the includeFiles array', () => {
    const parsed = parse([
      'watch',
      '--all',
      '--includeFiles',
      '**/*.ts',
      '--',
      'nx',
      'build',
    ]);
    // The trailing command lands in `command` (via the `--` middleware), not in
    // the includeFiles array — proving the array flag stops at `--`.
    expect(parsed.includeFiles).toEqual(['**/*.ts']);
    expect(parsed.command).toBe('nx build');
  });

  // The specs above hand argv straight to yargs. The real `nx` binary does not:
  // it runs argv through `rewriteTargetsAndProjects` first, which collapses the
  // space-delimited values of `--projects`/`--exclude`/`--files`/`--target(s)`
  // into one comma-joined value for `run-many`/`affected`. It keys off the flag
  // spelling alone, for every command, so a `nx watch --exclude a b` would have
  // arrived as the single pattern `a,b` — a glob that matches nothing. The
  // `Files` suffix is what keeps these flags out of that rewrite.
  it('survives the arg rewriter that collapses run-many-style list flags', () => {
    const argv = (flag: string) => [
      'node',
      'nx',
      'watch',
      '--all',
      flag,
      '**/*.spec.ts',
      '**/*.md',
      '--',
      'echo',
      'hi',
    ];

    expect(rewriteTargetsAndProjects(argv('--excludeFiles'))).toContain(
      '**/*.md'
    );
    expect(rewriteTargetsAndProjects(argv('--includeFiles'))).toContain(
      '**/*.md'
    );
    // The spelling this PR deliberately avoids, for contrast.
    expect(rewriteTargetsAndProjects(argv('--exclude'))).toContain(
      '**/*.spec.ts,**/*.md'
    );
  });
});
