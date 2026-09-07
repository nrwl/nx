import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
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

  it('reports a non-JSON generated config that collides with one on disk', async () => {
    // This used to fall through to the disk config. Measured against oxfmt
    // 0.60.0, every pair of discovered names is rejected - `.json`/`.jsonc`,
    // `.json`/`.config.ts`, `.config.ts`/`.config.mts` - so the flushed
    // directory is one the CLI refuses to load, whichever one was used here.
    writeConfig({ singleQuote: true });

    const { formatted, errors } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: 'const x =  "hi"' }],
      workspaceRoot,
      { name: 'oxfmt.config.ts', content: 'export default {};' }
    );

    expect(errors?.length).toBe(1);
    expect(errors[0]).toContain(".oxfmtrc.json' and 'oxfmt.config.ts'");
    expect(formatted.size).toBe(0);
  });

  it.each([
    [
      'oxfmt.config.ts',
      'const config: { singleQuote: boolean } = { singleQuote: true };\nexport default config;\n',
    ],
    [
      'oxfmt.config.mts',
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

    it('reads a staged root .editorconfig through the read callback', async () => {
      // A generator that creates the .editorconfig stages it in the tree, so
      // disk holds no copy until the flush.
      const { formatted } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'function f() {\n  const x = 1;\n}\n' }],
        workspaceRoot,
        undefined,
        undefined,
        (relativePath) =>
          relativePath === '.editorconfig'
            ? 'root = true\n\n[*]\nindent_size = 4\n'
            : null
      );

      expect(formatted.get('a.ts')).toEqual(
        'function f() {\n    const x = 1;\n}\n'
      );
    });

    it('prefers a staged root .editorconfig over the one on disk', async () => {
      writeEditorConfig('root = true\n\n[*]\nindent_size = 8\n');

      const { formatted } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'function f() {\n  const x = 1;\n}\n' }],
        workspaceRoot,
        undefined,
        undefined,
        (relativePath) =>
          relativePath === '.editorconfig'
            ? 'root = true\n\n[*]\nindent_size = 4\n'
            : null
      );

      expect(formatted.get('a.ts')).toEqual(
        'function f() {\n    const x = 1;\n}\n'
      );
    });

    it('does not apply a .editorconfig the read callback reports absent', async () => {
      // On disk but deleted in the tree: `read` returning null is the
      // post-flush truth, so the disk copy must not apply.
      writeEditorConfig('root = true\n\n[*]\nmax_line_length = 40\n');

      const { formatted, errors } = await formatFilesWithOxfmt(
        [
          {
            path: 'a.ts',
            content:
              'const someName = { alpha: 1, beta: 2, gamma: 3, delta: 4 };\n',
          },
        ],
        workspaceRoot,
        undefined,
        undefined,
        () => null
      );

      // Under oxfmt's default width the line stays whole; the disk file's 40
      // would split it.
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

    it('does not let one ignore file re-include what the other excluded', async () => {
      // The `merge: false` this path passes to `createIgnoreChainResolver`.
      // Merged instead, the `!` would win and the file would be rewritten -
      // and nothing else here would notice, since every other case uses one
      // ignore file at a time. The tree-backed twin is pinned separately in
      // `packages/nx/src/utils/ignore.spec.ts`.
      writeFileSync(join(workspaceRoot, '.gitignore'), 'both.ts\n', 'utf-8');
      writeFileSync(
        join(workspaceRoot, '.prettierignore'),
        '!both.ts\n',
        'utf-8'
      );

      const { formatted, errors } = await formatFilesWithOxfmt(
        [
          { path: 'both.ts', content: 'const x =  1' },
          { path: 'kept.ts', content: 'const y =  1' },
        ],
        workspaceRoot
      );

      expect(errors).toBeUndefined();
      expect([...formatted.keys()]).toEqual(['kept.ts']);
    });

    it('skips a file inside an ignored directory despite a nested negation', async () => {
      // Measured against the oxfmt 0.60.0 CLI: a scan skips `dist/keep.ts`
      // because it never enters `dist/`, so the nested negation is never read.
      // Without the ancestor walk the negation is the nearest opinion and the
      // file would be rewritten.
      writeFileSync(join(workspaceRoot, '.gitignore'), 'dist/\n', 'utf-8');
      mkdirSync(join(workspaceRoot, 'dist'), { recursive: true });
      writeFileSync(
        join(workspaceRoot, 'dist/.gitignore'),
        '!keep.ts\n',
        'utf-8'
      );

      const { formatted, errors } = await formatFilesWithOxfmt(
        [
          { path: 'dist/keep.ts', content: 'const x =  1' },
          { path: 'kept.ts', content: 'const y =  1' },
        ],
        workspaceRoot
      );

      expect(errors).toBeUndefined();
      expect([...formatted.keys()]).toEqual(['kept.ts']);
    });
  });

  describe('a config carried in the batch', () => {
    it('is used even when the caller passes no seedConfig', async () => {
      // A caller holding a tree may have the only copy of a just-written
      // config; on disk it is stale or absent until the tree flushes. Callers
      // that know which file it is still pass it explicitly - this is the
      // fallback, so `nx migrate`'s path and a generator's agree.
      writeFileSync(
        join(workspaceRoot, '.oxfmtrc.json'),
        JSON.stringify({ useTabs: false }),
        'utf-8'
      );

      const { formatted, errors } = await formatFilesWithOxfmt(
        [
          // `useTabs` rather than a quote style: false is oxfmt's default, so
          // an on-disk win and a batch win would look identical otherwise.
          { path: '.oxfmtrc.json', content: JSON.stringify({ useTabs: true }) },
          { path: 'a.ts', content: 'function f() {\nif (a) {\nb();\n}\n}' },
        ],
        workspaceRoot
      );

      expect(errors).toBeUndefined();
      expect(formatted.get('a.ts')).toContain('\tif (a) {');
    });

    it('loses to a seedConfig the caller passed', async () => {
      // The batch fallback is for callers that have no seed, not an override.
      // Both lookups agree today, so only this pins which one wins.
      const { formatted, errors } = await formatFilesWithOxfmt(
        [
          { path: '.oxfmtrc.json', content: JSON.stringify({ useTabs: true }) },
          { path: 'a.ts', content: 'function f() {\nif (a) {\nb();\n}\n}' },
        ],
        workspaceRoot,
        { name: '.oxfmtrc.json', content: JSON.stringify({ useTabs: false }) }
      );

      expect(errors).toBeUndefined();
      expect(formatted.get('a.ts')).toContain('  if (a) {');
    });

    it('reports a config it cannot read in memory rather than using defaults', async () => {
      // `.ts`/`.mts` configs need a loader and a real file, so the seed path
      // cannot evaluate them. Formatting on defaults instead would emit files
      // that disagree with the config the workspace is about to have, and fail
      // the next `nx format:check`.
      const { formatted, errors } = await formatFilesWithOxfmt(
        [
          {
            path: 'oxfmt.config.ts',
            content: 'export default { useTabs: true };',
          },
          { path: 'a.ts', content: 'function f() {\nif (a) {\nb();\n}\n}' },
        ],
        workspaceRoot
      );

      // One per file: the config resolves once for the batch, but its error is
      // recorded per file, so no file is formatted on defaults.
      expect(errors?.length).toBe(2);
      expect(errors[0]).toContain('oxfmt.config.ts');
      expect(formatted.size).toBe(0);
    });
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

  describe('nested configuration', () => {
    function writeFileIn(relativePath: string, contents: string) {
      const target = join(workspaceRoot, relativePath);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents, 'utf-8');
    }

    const wide = 'const someName = { alpha: 1, beta: 2, gamma: 3, delta: 4 };';

    it('uses the nearest config rather than the workspace root one', async () => {
      writeConfig({ printWidth: 100 });
      writeFileIn('apps/foo/.oxfmtrc.json', JSON.stringify({ printWidth: 40 }));

      const { formatted } = await formatFilesWithOxfmt(
        [
          { path: 'apps/foo/src/a.ts', content: wide },
          { path: 'root.ts', content: wide },
        ],
        workspaceRoot
      );

      expect(formatted.get('apps/foo/src/a.ts')).toContain('\n  alpha: 1,');
      expect(formatted.get('root.ts')).toEqual(`${wide}\n`);
    });

    it('replaces the parent config rather than merging with it', async () => {
      // Measured against the oxfmt CLI: a nested config that omits a key gets
      // oxfmt's default for it, NOT the value from the config above. Merging
      // here would format differently from `nx format:write`.
      writeConfig({ singleQuote: true, printWidth: 100 });
      writeFileIn('apps/foo/.oxfmtrc.json', JSON.stringify({ printWidth: 40 }));

      const { formatted } = await formatFilesWithOxfmt(
        [{ path: 'apps/foo/src/a.ts', content: 'const s =  "hi"' }],
        workspaceRoot
      );

      expect(formatted.get('apps/foo/src/a.ts')).toEqual('const s = "hi";\n');
    });

    it('lets an empty nested config discard every parent option', async () => {
      // The sharpest form of the rule above, measured against the CLI: an empty
      // `{}` leaves the file on oxfmt's own defaults, tabs and quotes included.
      writeConfig({ singleQuote: true, useTabs: true });
      writeFileIn('apps/foo/.oxfmtrc.json', '{}');

      const source = 'function f() {\nif (a) {\nconst s =  "hi";\n}\n}';
      const { formatted } = await formatFilesWithOxfmt(
        [
          { path: 'apps/foo/a.ts', content: source },
          { path: 'root.ts', content: source },
        ],
        workspaceRoot
      );

      expect(formatted.get('root.ts')).toContain("\t\tconst s = 'hi';");
      expect(formatted.get('apps/foo/a.ts')).toContain('    const s = "hi";');
    });

    it('honours a .gitignore in a subdirectory', async () => {
      writeConfig({ singleQuote: true });
      writeFileIn('apps/foo/.gitignore', 'skipme.ts\n');

      const { formatted } = await formatFilesWithOxfmt(
        [
          { path: 'apps/foo/skipme.ts', content: 'const x =  "hi"' },
          { path: 'apps/foo/keepme.ts', content: 'const x =  "hi"' },
        ],
        workspaceRoot
      );

      expect(formatted.has('apps/foo/skipme.ts')).toBe(false);
      expect(formatted.get('apps/foo/keepme.ts')).toEqual("const x = 'hi';\n");
    });

    it('anchors a nested .gitignore pattern at its own directory', async () => {
      writeConfig({ singleQuote: true });
      // A leading slash anchors to the directory holding the file. Matching it
      // against the workspace-relative path instead would never hit, so this is
      // what pins the rebasing - unlike a bare filename, which gitignore
      // matches at any depth either way.
      writeFileIn('apps/foo/.gitignore', '/generated/\n');

      const { formatted } = await formatFilesWithOxfmt(
        [
          { path: 'apps/foo/generated/a.ts', content: 'const x =  "hi"' },
          { path: 'generated/b.ts', content: 'const x =  "hi"' },
        ],
        workspaceRoot
      );

      expect(formatted.has('apps/foo/generated/a.ts')).toBe(false);
      // The same anchor must not reach the workspace's own `generated/`.
      expect(formatted.get('generated/b.ts')).toEqual("const x = 'hi';\n");
    });

    it('roots a nested config ignorePatterns at that config, not the workspace', async () => {
      writeConfig({ singleQuote: true });
      writeFileIn(
        'apps/foo/.oxfmtrc.json',
        JSON.stringify({ singleQuote: true, ignorePatterns: ['generated/**'] })
      );

      const { formatted } = await formatFilesWithOxfmt(
        [
          { path: 'apps/foo/generated/a.ts', content: 'const x =  "hi"' },
          // Same trailing segments, but not under the nested config, so the
          // pattern must not reach it.
          { path: 'other/generated/b.ts', content: 'const x =  "hi"' },
        ],
        workspaceRoot
      );

      expect(formatted.has('apps/foo/generated/a.ts')).toBe(false);
      expect(formatted.get('other/generated/b.ts')).toEqual(
        "const x = 'hi';\n"
      );
    });

    // Measured against the CLI: it resolves `.editorconfig` from its cwd, so a
    // file a directory down is never read - unlike `.oxfmtrc.json`, which it
    // does walk up for. Sizes are deliberately never 2 - that is oxfmt's
    // default, and an assertion on it would hold just as well if no
    // `.editorconfig` were found at all.
    it('ignores a nested .editorconfig, as the CLI does', async () => {
      writeConfig({});
      writeFileIn(
        '.editorconfig',
        '[*]\nindent_style = space\nindent_size = 8\n'
      );
      writeFileIn(
        'apps/foo/.editorconfig',
        '[*]\nindent_style = space\nindent_size = 4\n'
      );

      const { formatted } = await formatFilesWithOxfmt(
        [
          {
            path: 'apps/foo/src/a.ts',
            content: 'function f() {\nif (a) {\nb();\n}\n}',
          },
          { path: 'root.ts', content: 'function f() {\nif (a) {\nb();\n}\n}' },
        ],
        workspaceRoot
      );

      // Both take the root file's 8. The nested 4 would win under a per-file
      // walk, and the next `nx format:write` would undo it.
      expect(formatted.get('apps/foo/src/a.ts')).toContain(
        '\n        if (a) {'
      );
      expect(formatted.get('root.ts')).toContain('\n        if (a) {');
    });

    it('ignores a nested .editorconfig that declares root = true', async () => {
      writeConfig({});
      // `max_line_length` sits only in the root file, so it reveals whether the
      // nested `root = true` cut the chain short. Asserting on indent_size
      // alone would not: the nearer file sets it either way.
      writeFileIn(
        '.editorconfig',
        '[*]\nindent_style = space\nindent_size = 8\nmax_line_length = 40\n'
      );
      writeFileIn(
        'apps/foo/.editorconfig',
        'root = true\n\n[*]\nindent_style = space\nindent_size = 4\n'
      );

      const { formatted } = await formatFilesWithOxfmt(
        [
          {
            path: 'apps/foo/src/a.ts',
            content: `function f() {\nif (a) {\n${wide}\n}\n}`,
          },
        ],
        workspaceRoot
      );

      const result = formatted.get('apps/foo/src/a.ts');
      expect(result).toContain('\n        if (a) {');
      // Indented it is well past 40 columns, so the root file's max_line_length
      // splits it. It stayed on one line while the nested file was applied.
      expect(result).not.toContain('{ alpha: 1, beta: 2, gamma: 3, delta: 4 }');
    });

    it('reports an unreadable root .editorconfig instead of throwing', async () => {
      writeConfig({});
      // A directory reads as EISDIR, standing in for any non-ENOENT failure.
      mkdirSync(join(workspaceRoot, '.editorconfig'));

      const { formatted, errors } = await formatFilesWithOxfmt(
        [
          { path: 'a.ts', content: 'const x =  "hi"' },
          { path: 'b.ts', content: 'const x =  "hi"' },
        ],
        workspaceRoot
      );

      // The chain is resolved once for the batch, so this failure lands outside
      // the per-file catch. Every file fails rather than being formatted on bare
      // defaults, which would produce widths `nx format` does not.
      expect(errors?.length).toBe(2);
      expect(errors[0]).toContain('Could not read .editorconfig');
      expect(formatted.size).toBe(0);
    });

    // Measured against oxfmt 0.60.0: two config files in one directory make the
    // CLI exit 1 with "Both '.oxfmtrc.json' and '.oxfmtrc.jsonc' found in <dir>"
    // and format nothing. Taking the first match would format against a config
    // the next `nx format:write` refuses to load.
    it('reports two config files in one directory rather than picking one', async () => {
      writeConfig({ singleQuote: true });
      writeFileIn('.oxfmtrc.jsonc', '{ "singleQuote": false }');

      const { formatted, errors } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'const x =  "hi"' }],
        workspaceRoot
      );

      expect(errors?.length).toBe(1);
      expect(errors[0]).toContain(".oxfmtrc.json' and '.oxfmtrc.jsonc'");
      expect(formatted.size).toBe(0);
    });

    it('reports a staged config that collides with a different one on disk', async () => {
      // The tree has not flushed yet, so only one of the two is on disk - but
      // both will be once it does, which is when the CLI runs.
      writeConfig({ singleQuote: true });

      const { formatted, errors } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'const x =  "hi"' }],
        workspaceRoot,
        { name: '.oxfmtrc.jsonc', content: '{ "singleQuote": false }' }
      );

      expect(errors?.length).toBe(1);
      expect(errors[0]).toContain(".oxfmtrc.json' and '.oxfmtrc.jsonc'");
      expect(formatted.size).toBe(0);
    });

    it('still formats when a staged config replaces the one on disk', async () => {
      // Same name, so the flushed directory holds one file, not two. Guards the
      // duplicate check against firing on every seeded generator run.
      writeConfig({ singleQuote: false });

      const { formatted, errors } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'const x =  "hi"' }],
        workspaceRoot,
        { name: '.oxfmtrc.json', content: '{ "singleQuote": true }' }
      );

      expect(errors).toBeUndefined();
      expect(formatted.get('a.ts')).toEqual("const x = 'hi';\n");
    });

    it('ignores a root config the tree deletes when no seed replaces it', async () => {
      // The one path that reaches the disk-read loop with `rootConfigNames`: a
      // JSON seed returns before it, so this is what pins the loop to
      // `candidates` rather than every supported name.
      writeConfig({ useTabs: true });

      const { formatted, errors } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'function f() {\nif (a) {\nb();\n}\n}' }],
        workspaceRoot,
        undefined,
        []
      );

      expect(errors).toBeUndefined();
      // Spaces, not a tab: the config on its way out is not read.
      expect(formatted.get('a.ts')).toContain('\n  if (a) {');
    });

    it('reports a staged TypeScript config it cannot read yet', async () => {
      // Reading it means importing it, and it is not on disk. Formatting on
      // oxfmt's defaults instead would emit files the next `nx format:check`
      // rejects, so the batch has to say so.
      const { formatted, errors } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'const x =  "hi"' }],
        workspaceRoot,
        { name: 'oxfmt.config.ts', content: 'export default {};' },
        ['oxfmt.config.ts']
      );

      expect(errors?.length).toBe(1);
      expect(errors[0]).toContain('oxfmt.config.ts');
      expect(formatted.size).toBe(0);
    });

    it('reports a staged TypeScript config even when an older copy is on disk', async () => {
      // The case the previous guard let through: the path exists, so it loaded
      // the copy being replaced and formatted against the outgoing options.
      writeFileSync(
        join(workspaceRoot, 'oxfmt.config.ts'),
        'export default { useTabs: true };\n',
        'utf-8'
      );

      const { formatted, errors } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'function f() {\nif (a) {\nb();\n}\n}' }],
        workspaceRoot,
        {
          name: 'oxfmt.config.ts',
          content: 'export default { useTabs: false };\n',
        },
        ['oxfmt.config.ts']
      );

      expect(errors?.length).toBe(1);
      expect(errors[0]).toContain('oxfmt.config.ts');
      expect(formatted.size).toBe(0);
    });

    it('reports two configs that exist only in the tree', async () => {
      // Neither is on disk, so only the caller's post-flush view shows the pair
      // the CLI will refuse to load. One seed alone cannot.
      const { formatted, errors } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'const x =  "hi"' }],
        workspaceRoot,
        { name: '.oxfmtrc.json', content: '{ "singleQuote": true }' },
        ['.oxfmtrc.json', '.oxfmtrc.jsonc']
      );

      expect(errors?.length).toBe(1);
      expect(errors[0]).toContain(".oxfmtrc.json' and '.oxfmtrc.jsonc'");
      expect(formatted.size).toBe(0);
    });

    it('ignores a config the tree deletes rather than reporting a pair', async () => {
      // On disk until the flush removes it, so the two never coexist. The
      // surviving config still has to win over the one on its way out.
      writeConfig({ singleQuote: false });

      const { formatted, errors } = await formatFilesWithOxfmt(
        [{ path: 'a.ts', content: 'const x =  "hi"' }],
        workspaceRoot,
        { name: '.oxfmtrc.jsonc', content: '{ "singleQuote": true }' },
        ['.oxfmtrc.jsonc']
      );

      expect(errors).toBeUndefined();
      expect(formatted.get('a.ts')).toEqual("const x = 'hi';\n");
    });

    it('fails only the files under an unreadable nested config', async () => {
      writeConfig({ singleQuote: true });
      writeFileIn('apps/foo/.oxfmtrc.json', '{ not json');

      const { formatted, errors } = await formatFilesWithOxfmt(
        [
          { path: 'apps/foo/a.ts', content: 'const x =  "hi"' },
          { path: 'other/b.ts', content: 'const x =  "hi"' },
        ],
        workspaceRoot
      );

      expect(errors?.length).toBe(1);
      expect(errors[0]).toContain('apps/foo/.oxfmtrc.json');
      expect(formatted.has('apps/foo/a.ts')).toBe(false);
      expect(formatted.get('other/b.ts')).toEqual("const x = 'hi';\n");
    });
  });
});
