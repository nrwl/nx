import { createOverrides } from '@nx/devkit/internal';
// The option normalization Nx runs before an executor; no devkit barrel
// exposes it, and the spec is not published.
// oxlint-disable-next-line no-restricted-imports
import { combineOptionsForExecutor } from 'nx/src/utils/params';
import { resolveLintOptions } from './options';
import schema from './schema.json' with { type: 'json' };
import type { LintExecutorSchema } from './schema';

/** Resolves the options Nx hands the executor for `nx lint <project> ...cli`. */
const resolveFromCli = (cli: string[], target: LintExecutorSchema = {}) =>
  resolveLintOptions(
    combineOptionsForExecutor(
      createOverrides(cli),
      '',
      { options: target },
      schema as any,
      'a',
      null
    ) as LintExecutorSchema
  );

describe('resolveLintOptions', () => {
  it('should forward target options as Oxlint flags', () => {
    expect(
      resolveLintOptions({ typeAware: true, config: 'a.json', quiet: false })
    ).toMatchObject({ flags: ['--type-aware', '--config=a.json'] });
  });

  it('should forward CLI overrides verbatim and not duplicate their parsed form', () => {
    const resolved = resolveLintOptions({
      typeAware: true,
      __unparsed__: ['--type-aware', '--threads', '2'],
    });
    expect(resolved.flags).toEqual(['--type-aware', '--threads', '2']);
  });

  it('should forward any CLI flag form once, as typed', () => {
    expect(resolveFromCli(['-c', 'a.json']).flags).toEqual(['-c', 'a.json']);
    expect(resolveFromCli(['-Dno-debugger']).flags).toEqual(['-Dno-debugger']);
    expect(resolveFromCli(['libs/a/tools']).flags).toEqual(['libs/a/tools']);
    expect(resolveFromCli(['-f', 'json'])).toMatchObject({
      format: 'json',
      flags: [],
    });
    // Parsed as `ignore: false`, which matches no target option name.
    expect(resolveFromCli(['--no-ignore'], { noIgnore: true }).flags).toEqual([
      '--no-ignore',
    ]);
  });

  it('should split a CLI --args string as one string', () => {
    expect(resolveFromCli(['--args=--config configs/a.json']).flags).toEqual([
      '--config',
      'configs/a.json',
    ]);
    expect(
      resolveFromCli(["--args=--config 'configs/a,b.json'"]).flags
    ).toEqual(['--config', 'configs/a,b.json']);
    expect(resolveFromCli(['--args=-A', '--args=no-debugger']).flags).toEqual([
      '-A',
      'no-debugger',
    ]);
  });

  it('should not forward the CLI copies of its own options', () => {
    const resolved = resolveLintOptions({
      args: '--fix',
      lintFilePatterns: ['libs/a/src'],
      __unparsed__: ['--args=--fix', '--lintFilePatterns', 'libs/a/src'],
    });
    expect(resolved.flags).toEqual(['--fix']);
  });

  it('should keep quoted values and short flags intact in string args', () => {
    expect(
      resolveLintOptions({ args: '--config "configs/team oxlint.json" --fix' })
        .flags
    ).toEqual(['--config', 'configs/team oxlint.json', '--fix']);
    expect(resolveLintOptions({ args: '-c a.json src' }).flags).toEqual([
      '-c',
      'a.json',
      'src',
    ]);
    expect(
      resolveLintOptions({ args: `--config 'configs/a"b".json'` }).flags
    ).toEqual(['--config', 'configs/a"b".json']);
  });

  it('should append args after target options and before CLI overrides', () => {
    expect(
      resolveLintOptions({
        fix: true,
        args: ['--a'],
        __unparsed__: ['--b'],
      }).flags
    ).toEqual(['--fix', '--a', '--b']);
    expect(resolveLintOptions({ args: '--a --b' }).flags).toEqual([
      '--a',
      '--b',
    ]);
  });

  it('should keep warning thresholds for itself', () => {
    expect(
      resolveLintOptions({ maxWarnings: 3, denyWarnings: true })
    ).toMatchObject({
      maxWarnings: 3,
      denyWarnings: true,
      flags: [],
    });
    expect(
      resolveLintOptions({ __unparsed__: ['--max-warnings', '0'] })
    ).toMatchObject({ maxWarnings: 0, flags: [] });
  });

  it("should drop Nx's own --verbose", () => {
    expect(
      resolveLintOptions({
        verbose: true,
        __unparsed__: ['--verbose', '--fix'],
      }).flags
    ).toEqual(['--fix']);
  });

  it('should keep --silent and --format for itself', () => {
    expect(
      resolveLintOptions({ __unparsed__: ['--silent', '--format=github'] })
    ).toMatchObject({ silent: true, format: 'github', flags: [] });
    expect(resolveLintOptions({ args: ['-f', 'json'] })).toMatchObject({
      format: 'json',
      flags: [],
    });
    expect(resolveFromCli(['-fjson'])).toMatchObject({
      format: 'json',
      flags: [],
    });
    expect(resolveLintOptions({ format: 'agent' })).toMatchObject({
      format: 'agent',
    });
  });

  it("should let a format in args override the schema's default format", () => {
    expect(
      resolveLintOptions({ format: 'default', args: ['--format=json'] })
    ).toMatchObject({ format: 'json' });
  });

  it('should reject formats it cannot render', () => {
    expect(() => resolveLintOptions({ args: ['--format=sarif'] })).toThrow(
      /Unsupported Oxlint output format "sarif"/
    );
  });
});
