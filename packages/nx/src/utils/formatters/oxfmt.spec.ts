import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatFilesWithOxfmt } from './oxfmt';

describe('formatFilesWithOxfmt', () => {
  let workspaceRoot: string;

  beforeEach(() => {
    workspaceRoot = mkdtempSync(join(tmpdir(), 'nx-oxfmt-spec-'));
  });

  afterEach(() => {
    rmSync(workspaceRoot, { recursive: true, force: true });
  });

  function writeConfig(config: object) {
    writeFileSync(
      join(workspaceRoot, '.oxfmtrc.json'),
      JSON.stringify(config),
      'utf-8'
    );
  }

  it('formats files without writing anything into the workspace', async () => {
    writeConfig({ singleQuote: true });

    const { formatted, errors } = await formatFilesWithOxfmt(
      [{ path: 'libs/lib1/src/index.ts', content: 'const x =  "hi"' }],
      workspaceRoot
    );

    expect(errors).toBeUndefined();
    expect(formatted.get('libs/lib1/src/index.ts')).toEqual(
      "const x = 'hi';\n"
    );
    // The generator's files must never be staged inside the workspace: doing so
    // races the daemon's file watcher while a generator is running.
    expect(readdirSync(workspaceRoot)).toEqual(['.oxfmtrc.json']);
  });

  it('honours the workspace config', async () => {
    // Deliberately not `singleQuote: false`: that is oxfmt's own default, so
    // the assertion would hold just as well if the config were never read.
    writeConfig({ useTabs: true });

    const { formatted } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: 'function f() {\nif (a) {\nb();\n}\n}' }],
      workspaceRoot
    );

    expect(formatted.get('a.ts')).toContain('\tif (a) {');
  });

  it('prefers a config the generator just created over the one on disk', async () => {
    writeConfig({ singleQuote: false });

    const { formatted } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: 'const x =  "hi"' }],
      workspaceRoot,
      { name: '.oxfmtrc.json', content: JSON.stringify({ singleQuote: true }) }
    );

    expect(formatted.get('a.ts')).toEqual("const x = 'hi';\n");
  });

  it('falls through to the config on disk when the generated config is not JSON', async () => {
    // `singleQuote: true` rather than `false` so the assertion distinguishes
    // the disk config from oxfmt's defaults - with `false` this test passes
    // even when the fall-through is removed entirely.
    writeConfig({ singleQuote: true });

    const { formatted } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: 'const x =  "hi"' }],
      workspaceRoot,
      { name: 'oxfmt.config.ts', content: 'export default {};' }
    );

    // Not the bare oxfmt defaults - the workspace's own config still applies.
    expect(formatted.get('a.ts')).toEqual("const x = 'hi';\n");
  });

  // `oxfmt.config.mts` is discovered too, but jest's module registry does not
  // implement `require(esm)`, so `loadTsFile` cannot reach it here. Real Node
  // (the `^20.19.0 || >=22.12.0` oxfmt supports) requires an ESM `.mts`
  // directly - measured - so this is a limit of the test environment, not of
  // the loader.
  it.each([
    [
      'oxfmt.config.ts',
      'const config: { singleQuote: boolean } = { singleQuote: true };\nexport default config;\n',
    ],
  ])('honours a %s config, which has to be executed', async (name, content) => {
    writeFileSync(join(workspaceRoot, name), content, 'utf-8');

    const { formatted } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: 'const x =  "hi"' }],
      workspaceRoot
    );

    expect(formatted.get('a.ts')).toEqual("const x = 'hi';\n");
  });

  it.each(['oxfmt.config.cjs', 'oxfmt.config.js', 'oxfmt.config.cts'])(
    'ignores %s, which oxfmt accepts via -c but never discovers',
    async (name) => {
      writeFileSync(
        join(workspaceRoot, name),
        'module.exports = { singleQuote: true };',
        'utf-8'
      );

      const { formatted } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'const x =  "hi"' }],
        workspaceRoot
      );

      // Double quotes - oxfmt's defaults. Treating the file as a config would
      // format on options `nx format` itself ignores.
      expect(formatted.get('a.ts')).toEqual('const x = "hi";\n');
    }
  );

  it('reports a config it cannot read and formats nothing', async () => {
    writeFileSync(join(workspaceRoot, '.oxfmtrc.json'), 'not json', 'utf-8');

    const { formatted, errors } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: 'const x =  1' }],
      workspaceRoot
    );

    // oxfmt never sees the file - it is handed options in memory - so nothing
    // else would tell the user their config is unusable.
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('.oxfmtrc.json');
    // An unreadable config costs the workspace's style *and* its
    // ignorePatterns, so formatting on defaults would rewrite files the config
    // asks to skip - and tree.write is not undone by a warning.
    expect(formatted.size).toBe(0);
  });

  it('reports a generated config it cannot parse without falling back to disk', async () => {
    // Unlike the on-disk lookup, a seed the generator just wrote is the config
    // the batch is meant to use - quietly formatting to the previous one would
    // mismatch the file it just shipped.
    writeConfig({ singleQuote: true });

    const { formatted, errors } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: 'const x =  "hi"' }],
      workspaceRoot,
      { name: '.oxfmtrc.json', content: '{ "singleQuote": ' }
    );

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('.oxfmtrc.json');
    expect(formatted.size).toBe(0);
  });

  it('skips a batch whose ignorePatterns cannot be read rather than formatting past them', async () => {
    writeFileSync(
      join(workspaceRoot, '.oxfmtrc.json'),
      '{ "ignorePatterns": ["libs/generated/**"], ',
      'utf-8'
    );

    const { formatted, errors } = await formatFilesWithOxfmt(
      [{ path: 'libs/generated/api.ts', content: 'const x =  1' }],
      workspaceRoot
    );

    expect(errors).toHaveLength(1);
    expect(formatted.size).toBe(0);
  });

  describe('config keys the programmatic API does not accept', () => {
    // `overrides` and `ignorePatterns` exist only on oxfmt's config-file
    // schema. Passing them to `format()` would silently drop them, so a
    // generator would format a file differently from `nx format`.

    it('applies overrides to the files they match', async () => {
      writeConfig({
        singleQuote: false,
        overrides: [
          { files: ['libs/**/*.ts'], options: { singleQuote: true } },
        ],
      });

      const { formatted } = await formatFilesWithOxfmt(
        [
          { path: 'libs/lib1/a.ts', content: 'const x =  "hi"' },
          { path: 'root.ts', content: 'const y =  "hi"' },
        ],
        workspaceRoot
      );

      expect(formatted.get('libs/lib1/a.ts')).toEqual("const x = 'hi';\n");
      expect(formatted.get('root.ts')).toEqual('const y = "hi";\n');
    });

    it('matches a glob with no separator at any depth, as the CLI does', async () => {
      // oxfmt lifts a separator-less pattern to `**/<pattern>`. This is the
      // shape a prettier config carries over (`"files": "*.spec.ts"`), so
      // anchoring it at the root would silently skip every nested match.
      writeConfig({
        singleQuote: false,
        overrides: [{ files: ['*.ts'], options: { singleQuote: true } }],
      });

      const { formatted } = await formatFilesWithOxfmt(
        [
          { path: 'libs/lib1/deep.ts', content: 'const x =  "hi"' },
          { path: 'root.ts', content: 'const y =  "hi"' },
        ],
        workspaceRoot
      );

      expect(formatted.get('libs/lib1/deep.ts')).toEqual("const x = 'hi';\n");
      expect(formatted.get('root.ts')).toEqual("const y = 'hi';\n");
    });

    it('treats a leading bang as a negation, as the CLI does', async () => {
      // oxfmt normalizes the pattern and then matches with fast-glob, whose
      // glob_match inverts on a leading `!` - so this override applies to
      // everything *outside* libs/.
      writeConfig({
        singleQuote: false,
        overrides: [
          { files: ['!libs/**/*.ts'], options: { singleQuote: true } },
        ],
      });

      const { formatted } = await formatFilesWithOxfmt(
        [
          { path: 'root.ts', content: 'const x =  "hi"' },
          { path: 'libs/lib1/a.ts', content: 'const y =  "hi"' },
        ],
        workspaceRoot
      );

      expect(formatted.get('root.ts')).toEqual("const x = 'hi';\n");
      expect(formatted.get('libs/lib1/a.ts')).toEqual('const y = "hi";\n');
    });

    it('collapses a negated leading globstar to one segment, as the CLI does', async () => {
      // Measured against oxfmt 0.60.0: `!**/t.ts` selects the same set as
      // `!*/t.ts` - it matches `t.ts` and `a/b/t.ts` but not `a/t.ts`.
      // minimatch's zero-or-more `**` would invert to nothing, so the override
      // would apply to no file at all under a generator while `nx format`
      // applied it to most of them.
      writeConfig({
        singleQuote: false,
        overrides: [{ files: ['!**/t.ts'], options: { singleQuote: true } }],
      });

      const { formatted } = await formatFilesWithOxfmt(
        [
          { path: 't.ts', content: 'const a =  "hi"' },
          { path: 'a/t.ts', content: 'const b =  "hi"' },
          { path: 'a/b/t.ts', content: 'const c =  "hi"' },
        ],
        workspaceRoot
      );

      expect(formatted.get('t.ts')).toEqual("const a = 'hi';\n");
      expect(formatted.get('a/t.ts')).toEqual('const b = "hi";\n');
      expect(formatted.get('a/b/t.ts')).toEqual("const c = 'hi';\n");
    });

    it('leaves a doubled leading globstar alone under negation', async () => {
      // Measured: `!**/**/t.ts` selects every path that is *not* a `t.ts`,
      // identically under the CLI and minimatch, because only a *single*
      // leading globstar gets collapsed. `other.ts` is what pins that - without
      // it this asserts only the negative half and would pass even if the
      // override were inert.
      writeConfig({
        singleQuote: false,
        overrides: [{ files: ['!**/**/t.ts'], options: { singleQuote: true } }],
      });

      const { formatted } = await formatFilesWithOxfmt(
        [
          { path: 't.ts', content: 'const a =  "hi"' },
          { path: 'a/t.ts', content: 'const b =  "hi"' },
          { path: 'a/b/t.ts', content: 'const c =  "hi"' },
          { path: 'other.ts', content: 'const d =  "hi"' },
        ],
        workspaceRoot
      );

      expect(formatted.get('t.ts')).toEqual('const a = "hi";\n');
      expect(formatted.get('a/t.ts')).toEqual('const b = "hi";\n');
      expect(formatted.get('a/b/t.ts')).toEqual('const c = "hi";\n');
      // The override *does* apply here - it selects everything that is not a
      // `t.ts`.
      expect(formatted.get('other.ts')).toEqual("const d = 'hi';\n");
    });

    it('leaves an interior globstar alone under negation', async () => {
      // `!a/**/t.ts` agrees between oxfmt and minimatch as written - only the
      // *leading* globstar needed rewriting, so the rewrite must not reach
      // this shape.
      writeConfig({
        singleQuote: false,
        overrides: [{ files: ['!a/**/t.ts'], options: { singleQuote: true } }],
      });

      const { formatted } = await formatFilesWithOxfmt(
        [
          { path: 't.ts', content: 'const a =  "hi"' },
          { path: 'a/t.ts', content: 'const b =  "hi"' },
          { path: 'a/b/t.ts', content: 'const c =  "hi"' },
        ],
        workspaceRoot
      );

      expect(formatted.get('t.ts')).toEqual("const a = 'hi';\n");
      expect(formatted.get('a/t.ts')).toEqual('const b = "hi";\n');
      expect(formatted.get('a/b/t.ts')).toEqual('const c = "hi";\n');
    });

    it('reports a config shape oxfmt would refuse to load', async () => {
      // The CLI fails with "invalid type: integer, expected a string" and
      // formats nothing; dropping the bad entry instead would format past the
      // exclusions the config asked for.
      writeConfig({ ignorePatterns: ['libs/generated/**', 123] });

      const { formatted, errors } = await formatFilesWithOxfmt(
        [{ path: 'libs/generated/api.ts', content: 'const x =  1' }],
        workspaceRoot
      );

      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain('ignorePatterns');
      expect(formatted.size).toBe(0);
    });

    it.each([
      ['a bare string for files', { files: 'libs/**/*.ts' }],
      [
        'a bare string for excludeFiles',
        { files: ['**/*.ts'], excludeFiles: 'x.ts' },
      ],
      ['a non-string glob', { files: ['**/*.ts', 7] }],
      // oxfmt's `OxfmtOverrideConfig` marks `files` required, so an override
      // that omits it - a typo'd `include`, say - fails the whole config with
      // "missing field `files`" rather than matching nothing.
      ['no files at all', { options: { singleQuote: true } }],
      ['a null entry', null],
    ])(
      'reports an overrides shape oxfmt would refuse to load: %s',
      async (_name, override) => {
        writeConfig({ overrides: [override] });

        const { formatted, errors } = await formatFilesWithOxfmt(
          [{ path: 'a.ts', content: 'const x =  1' }],
          workspaceRoot
        );

        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain('overrides');
        // Formatting on the base options instead would apply a config `nx format`
        // refuses to load at all.
        expect(formatted.size).toBe(0);
      }
    );

    it.each(['ignorePatterns', 'overrides'])(
      'treats an explicit null %s the way oxfmt does, as absent',
      async (key) => {
        // serde maps JSON null onto `Option<T>` as absent, so the CLI formats
        // this config without complaint. Rejecting it would strand every
        // generator in a workspace `nx format` handles fine.
        writeConfig({ singleQuote: true, [key]: null });

        const { formatted, errors } = await formatFilesWithOxfmt(
          [{ path: 'a.ts', content: 'const x =  "hi"' }],
          workspaceRoot
        );

        expect(errors).toBeUndefined();
        expect(formatted.get('a.ts')).toEqual("const x = 'hi';\n");
      }
    );

    it('honours a separator-less excludeFiles at any depth', async () => {
      writeConfig({
        singleQuote: false,
        overrides: [
          {
            files: ['**/*.ts'],
            excludeFiles: ['skip-*.ts'],
            options: { singleQuote: true },
          },
        ],
      });

      const { formatted } = await formatFilesWithOxfmt(
        [
          { path: 'libs/lib1/a.ts', content: 'const x =  "hi"' },
          { path: 'libs/lib1/skip-me.ts', content: 'const y =  "hi"' },
        ],
        workspaceRoot
      );

      expect(formatted.get('libs/lib1/a.ts')).toEqual("const x = 'hi';\n");
      expect(formatted.get('libs/lib1/skip-me.ts')).toEqual(
        'const y = "hi";\n'
      );
    });

    it('honours excludeFiles on an override', async () => {
      writeConfig({
        singleQuote: false,
        overrides: [
          {
            files: ['libs/**/*.ts'],
            excludeFiles: ['libs/**/skip-*.ts'],
            options: { singleQuote: true },
          },
        ],
      });

      const { formatted } = await formatFilesWithOxfmt(
        [
          { path: 'libs/lib1/a.ts', content: 'const x =  "hi"' },
          { path: 'libs/lib1/skip-me.ts', content: 'const y =  "hi"' },
        ],
        workspaceRoot
      );

      expect(formatted.get('libs/lib1/a.ts')).toEqual("const x = 'hi';\n");
      expect(formatted.get('libs/lib1/skip-me.ts')).toEqual(
        'const y = "hi";\n'
      );
    });

    it('lets a later override win', async () => {
      writeConfig({
        overrides: [
          { files: ['**/*.ts'], options: { tabWidth: 4 } },
          { files: ['libs/**/*.ts'], options: { tabWidth: 8 } },
        ],
      });

      const { formatted } = await formatFilesWithOxfmt(
        [
          {
            path: 'libs/lib1/a.ts',
            content: 'function f() {\nconst x = 1;\n}\n',
          },
        ],
        workspaceRoot
      );

      expect(formatted.get('libs/lib1/a.ts')).toEqual(
        'function f() {\n        const x = 1;\n}\n'
      );
    });

    it('skips files covered by ignorePatterns', async () => {
      writeConfig({ ignorePatterns: ['libs/**/generated-*.ts'] });

      const { formatted, errors } = await formatFilesWithOxfmt(
        [
          { path: 'libs/lib1/generated-api.ts', content: 'const x =  1' },
          { path: 'libs/lib1/index.ts', content: 'const y =  1' },
        ],
        workspaceRoot
      );

      expect(errors).toBeUndefined();
      expect([...formatted.keys()]).toEqual(['libs/lib1/index.ts']);
    });
  });

  describe('.editorconfig', () => {
    function writeEditorConfig(contents: string) {
      writeFileSync(join(workspaceRoot, '.editorconfig'), contents, 'utf-8');
    }

    it('applies the properties oxfmt has an equivalent for', async () => {
      writeEditorConfig(
        'root = true\n\n[*]\nindent_size = 4\nquote_type = single\n'
      );

      const { formatted } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'function f() {\n  const x = "hi";\n}\n' }],
        workspaceRoot
      );

      expect(formatted.get('a.ts')).toEqual(
        "function f() {\n    const x = 'hi';\n}\n"
      );
    });

    it('lets the oxfmt config override it', async () => {
      writeEditorConfig('[*]\nquote_type = single\nindent_size = 4\n');
      writeConfig({ singleQuote: false });

      const { formatted } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'function f() {\n  const x = "hi";\n}\n' }],
        workspaceRoot
      );

      // The indent still comes from .editorconfig, the quotes from oxfmt.
      expect(formatted.get('a.ts')).toEqual(
        'function f() {\n    const x = "hi";\n}\n'
      );
    });

    it('lets an override win over it', async () => {
      writeEditorConfig('[*]\nindent_size = 4\n');
      writeConfig({
        overrides: [{ files: ['libs/**/*.ts'], options: { tabWidth: 8 } }],
      });

      const { formatted } = await formatFilesWithOxfmt(
        [
          {
            path: 'libs/lib1/a.ts',
            content: 'function f() {\nconst x = 1;\n}\n',
          },
          { path: 'root.ts', content: 'function g() {\nconst y = 1;\n}\n' },
        ],
        workspaceRoot
      );

      expect(formatted.get('libs/lib1/a.ts')).toEqual(
        'function f() {\n        const x = 1;\n}\n'
      );
      expect(formatted.get('root.ts')).toEqual(
        'function g() {\n    const y = 1;\n}\n'
      );
    });

    it('only applies a section to the files it matches', async () => {
      writeEditorConfig('[*]\nindent_size = 2\n\n[*.ts]\nindent_size = 8\n');

      const { formatted } = await formatFilesWithOxfmt(
        [
          {
            path: 'libs/lib1/deep.ts',
            content: 'function f() {\nconst x = 1;\n}\n',
          },
          {
            path: 'libs/lib1/other.js',
            content: 'function g() {\nconst y = 1;\n}\n',
          },
        ],
        workspaceRoot
      );

      // The nested .ts file matches `[*.ts]` and gets 8 spaces; the .js file
      // only matches `[*]` and gets 2 - asserted positively, so the test still
      // fails if the .js file were skipped or errored instead.
      expect(formatted.get('libs/lib1/deep.ts')).toEqual(
        'function f() {\n        const x = 1;\n}\n'
      );
      expect(formatted.get('libs/lib1/other.js')).toEqual(
        'function g() {\n  const y = 1;\n}\n'
      );
    });

    it('ignores values it has no meaning for', async () => {
      writeEditorConfig('[*]\nindent_size = unset\nmax_line_length = off\n');

      const { formatted, errors } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'function f() {\n  const x = 1;\n}\n' }],
        workspaceRoot
      );

      expect(errors).toBeUndefined();
      expect(formatted.size).toBe(0);
    });
  });

  describe('ignore files', () => {
    it.each(['.gitignore', '.prettierignore'])(
      'skips files covered by %s',
      async (name) => {
        writeFileSync(
          join(workspaceRoot, name),
          'dist/\ngenerated-*.ts\n',
          'utf-8'
        );

        const { formatted, errors } = await formatFilesWithOxfmt(
          [
            { path: 'dist/bundle.ts', content: 'const x =  1' },
            { path: 'libs/lib1/generated-api.ts', content: 'const y =  1' },
            { path: 'libs/lib1/src/index.ts', content: 'const z =  1' },
          ],
          workspaceRoot
        );

        expect(errors).toBeUndefined();
        expect([...formatted.keys()]).toEqual(['libs/lib1/src/index.ts']);
      }
    );
  });

  describe('absolute paths', () => {
    // `writeFormattedJsonFile` passes absolute paths (nx migrate writes
    // migrations.json, package.json and nx.json through it). The ignore
    // matcher rejects any path it considers non-relative, so an unguarded
    // check there used to reject the whole batch.

    it('formats a file addressed by its absolute path', async () => {
      writeFileSync(join(workspaceRoot, '.gitignore'), 'dist/\n', 'utf-8');
      const absolute = join(workspaceRoot, 'migrations.json');

      const { formatted, errors } = await formatFilesWithOxfmt(
        [
          { path: absolute, content: '{"migrations":  []}' },
          { path: 'fine.ts', content: 'const y =  1' },
        ],
        workspaceRoot
      );

      expect(errors).toBeUndefined();
      // The rest of the batch survives, and the absolute path is keyed back
      // exactly as the caller passed it.
      expect(formatted.get('fine.ts')).toEqual('const y = 1;\n');
      expect(formatted.get(absolute)).toEqual('{ "migrations": [] }\n');
    });

    it('still applies ignore files to an absolute path', async () => {
      writeFileSync(join(workspaceRoot, '.gitignore'), 'dist/\n', 'utf-8');

      const { formatted, errors } = await formatFilesWithOxfmt(
        [
          {
            path: join(workspaceRoot, 'dist/bundle.ts'),
            content: 'const x =  1',
          },
        ],
        workspaceRoot
      );

      // `errors` matters as much as the empty map: an un-normalised path makes
      // the matcher throw, which would also leave the file unformatted and so
      // satisfy the size assertion on its own.
      expect(errors).toBeUndefined();
      expect(formatted.size).toBe(0);
    });

    it('formats a path outside the workspace instead of erroring on it', async () => {
      // The workspace's ignore files cannot cover it, so there is nothing to
      // check - but the matcher rejects any path it cannot read as relative,
      // so this must not reach it.
      writeFileSync(join(workspaceRoot, '.gitignore'), 'dist/\n', 'utf-8');
      const outside = join(workspaceRoot, '..', 'outside.ts');

      const { formatted, errors } = await formatFilesWithOxfmt(
        [{ path: outside, content: 'const x =  1' }],
        workspaceRoot
      );

      expect(errors).toBeUndefined();
      expect(formatted.get(outside)).toEqual('const x = 1;\n');
    });
  });

  it('leaves files it has no parser for alone without reporting an error', async () => {
    const { formatted, errors } = await formatFilesWithOxfmt(
      [
        { path: 'libs/lib1/.gitkeep', content: 'x' },
        { path: 'libs/lib1/logo.png', content: 'not really a png' },
      ],
      workspaceRoot
    );

    expect(errors).toBeUndefined();
    expect(formatted.size).toBe(0);
  });

  it('keeps one unparseable file from costing the rest of the batch', async () => {
    const { formatted, errors } = await formatFilesWithOxfmt(
      [
        { path: 'broken.ts', content: 'const y = {{{' },
        { path: 'fine.ts', content: 'const y =  1' },
      ],
      workspaceRoot
    );

    expect(errors).toHaveLength(1);
    expect(formatted.has('broken.ts')).toBe(false);
    expect(formatted.get('fine.ts')).toEqual('const y = 1;\n');
  });

  it('names every file that failed, not just the first', async () => {
    const { errors } = await formatFilesWithOxfmt(
      [
        { path: 'libs/lib1/broken.ts', content: 'const y = {{{' },
        { path: 'libs/lib2/alsobroken.ts', content: 'const z = {{{' },
      ],
      workspaceRoot
    );

    // oxfmt's own message is context-free ("Unexpected token"), so the path
    // has to come from here or the user cannot act on the warning.
    expect(errors).toHaveLength(2);
    expect(errors.join('\n')).toContain('libs/lib1/broken.ts');
    expect(errors.join('\n')).toContain('libs/lib2/alsobroken.ts');
  });

  it('returns nothing to write when a file is already formatted', async () => {
    const { formatted, errors } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: 'const x = 1;\n' }],
      workspaceRoot
    );

    expect(errors).toBeUndefined();
    expect(formatted.size).toBe(0);
  });
});
