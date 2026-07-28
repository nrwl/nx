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

    const { formatted, error } = await formatFilesWithOxfmt(
      [{ path: 'libs/lib1/src/index.ts', content: 'const x =  "hi"' }],
      workspaceRoot
    );

    expect(error).toBeUndefined();
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

  it.each([
    ['oxfmt.config.cjs', 'module.exports = { singleQuote: true };'],
    [
      'oxfmt.config.ts',
      'const config: { singleQuote: boolean } = { singleQuote: true };\nexport default config;\n',
    ],
  ])('honours a %s config, which has to be executed', async (name, content) => {
    rmSync(join(workspaceRoot, '.oxfmtrc.json'), { force: true });
    writeFileSync(join(workspaceRoot, name), content, 'utf-8');

    const { formatted } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: 'const x =  "hi"' }],
      workspaceRoot
    );

    expect(formatted.get('a.ts')).toEqual("const x = 'hi';\n");
  });

  it('falls back to the defaults when the config cannot be read', async () => {
    writeFileSync(join(workspaceRoot, '.oxfmtrc.json'), 'not json', 'utf-8');

    const { formatted, error } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: 'const x =  1' }],
      workspaceRoot
    );

    expect(error).toBeUndefined();
    expect(formatted.get('a.ts')).toEqual('const x = 1;\n');
  });

  it('leaves files it has no parser for alone without reporting an error', async () => {
    const { formatted, error } = await formatFilesWithOxfmt(
      [
        { path: 'libs/lib1/.gitkeep', content: 'x' },
        { path: 'libs/lib1/logo.png', content: 'not really a png' },
      ],
      workspaceRoot
    );

    expect(error).toBeUndefined();
    expect(formatted.size).toBe(0);
  });

  it('keeps one unparseable file from costing the rest of the batch', async () => {
    const { formatted, error } = await formatFilesWithOxfmt(
      [
        { path: 'broken.ts', content: 'const y = {{{' },
        { path: 'fine.ts', content: 'const y =  1' },
      ],
      workspaceRoot
    );

    expect(error).toBeDefined();
    expect(formatted.has('broken.ts')).toBe(false);
    expect(formatted.get('fine.ts')).toEqual('const y = 1;\n');
  });

  it('returns nothing to write when a file is already formatted', async () => {
    const { formatted, error } = await formatFilesWithOxfmt(
      [{ path: 'a.ts', content: 'const x = 1;\n' }],
      workspaceRoot
    );

    expect(error).toBeUndefined();
    expect(formatted.size).toBe(0);
  });
});
