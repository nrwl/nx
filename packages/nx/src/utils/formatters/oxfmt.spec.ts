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
    writeConfig({ singleQuote: false });

    const { formatted } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: "const x =  'hi'" }],
      workspaceRoot
    );

    expect(formatted.get('a.ts')).toEqual('const x = "hi";\n');
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
    writeConfig({ singleQuote: false });

    const { formatted } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: "const x =  'hi'" }],
      workspaceRoot,
      { name: 'oxfmt.config.js', content: 'module.exports = {};' }
    );

    // Not the bare oxfmt defaults - the workspace's own config still applies.
    expect(formatted.get('a.ts')).toEqual('const x = "hi";\n');
  });

  it.each([
    ['oxfmt.config.cjs', 'module.exports = { singleQuote: true };'],
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

  it('reports a config it cannot read instead of silently using the defaults', async () => {
    writeFileSync(join(workspaceRoot, '.oxfmtrc.json'), 'not json', 'utf-8');

    const { formatted, errors } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: 'const x =  1' }],
      workspaceRoot
    );

    // oxfmt never sees the file - it is handed options in memory - so nothing
    // else would tell the user their config is unusable.
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('.oxfmtrc.json');
    // Formatting still happens, on oxfmt's defaults.
    expect(formatted.get('a.ts')).toEqual('const x = 1;\n');
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

      const { formatted } = await formatFilesWithOxfmt(
        [
          {
            path: join(workspaceRoot, 'dist/bundle.ts'),
            content: 'const x =  1',
          },
        ],
        workspaceRoot
      );

      expect(formatted.size).toBe(0);
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
