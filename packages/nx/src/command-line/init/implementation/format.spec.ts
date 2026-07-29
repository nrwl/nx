import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatInitWrites, recordInitWrite } from './format';
import { markPackageJsonAsNxProject } from './utils';
import { output } from '../../../utils/output';

// `filterToPrettierSupportedFiles` reaches prettier through a dynamic import,
// which jest refuses without `--experimental-vm-modules`. Only that lookup is
// replaced - the real `writeWithPrettier` still runs, so these tests still
// prove prettier formatted the file.
jest.mock('../../../utils/formatters/prettier', () => ({
  ...jest.requireActual('../../../utils/formatters/prettier'),
  filterToPrettierSupportedFiles: async (files: string[]) =>
    files.filter((file) => /\.(json|js|jsx|ts|tsx|md|ya?ml)$/.test(file)),
}));

describe('formatInitWrites', () => {
  let repoRoot: string;
  let skipFormatBackup: string | undefined;
  let warn: jest.SpyInstance;

  const UNFORMATTED = '{"name":"x",\n    "private":   true}';
  const FORMATTED = '{\n  "name": "x",\n  "private": true\n}\n';
  const FORMATTED_TABS = '{\n\t"name": "x",\n\t"private": true\n}\n';

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'nx-init-format-'));
    skipFormatBackup = process.env.NX_SKIP_FORMAT;
    delete process.env.NX_SKIP_FORMAT;
    warn = jest.spyOn(output, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    // Every test records something; drain it so state cannot leak between them.
    await formatInitWrites(repoRoot);
    warn.mockRestore();
    rmSync(repoRoot, { recursive: true, force: true });
    if (skipFormatBackup === undefined) delete process.env.NX_SKIP_FORMAT;
    else process.env.NX_SKIP_FORMAT = skipFormatBackup;
  });

  function write(name: string, content = UNFORMATTED): string {
    const filePath = join(repoRoot, name);
    writeFileSync(filePath, content, 'utf-8');
    return filePath;
  }

  const read = (name: string) => readFileSync(join(repoRoot, name), 'utf-8');

  // `useTabs` rather than a default-valued option, and each formatter gets a
  // config only it reads. On the shared default both formatters emit
  // byte-identical `package.json`, so the rows could not tell "oxfmt ran" from
  // "prettier ran" - dispatching every oxfmt workspace to prettier would pass.
  it.each([
    ['prettier', '.prettierrc'],
    ['oxfmt', '.oxfmtrc.json'],
  ])(
    'formats what init wrote with %s, using its own config',
    async (_formatter, config) => {
      write(config, JSON.stringify({ useTabs: true }));
      const packageJson = write('package.json');

      recordInitWrite(packageJson);
      await formatInitWrites(repoRoot);

      expect(read('package.json')).toEqual(FORMATTED_TABS);
    }
  );

  it('formats a file a real init helper wrote', async () => {
    // Guards the wiring, not just this module: `writeJsonFile` hardcodes
    // 2-space indent and writes no trailing newline, so what init produces is
    // unformatted no matter what the repo is configured for.
    write('.prettierrc', JSON.stringify({ useTabs: true }));
    write('package.json', '{"name":"x","scripts":{"build":"tsc"}}');

    markPackageJsonAsNxProject(join(repoRoot, 'package.json'));
    expect(read('package.json')).not.toMatch(/\n$/);

    await formatInitWrites(repoRoot);

    expect(read('package.json')).toMatch(/\n$/);
    expect(read('package.json')).toContain('\t"name"');
  });

  it('drops a recorded file prettier has no parser for, and stays quiet', async () => {
    // Measured: prettier still formats the rest of the batch, but exits 2 and
    // prints `No parser could be inferred`. So without the filter a successful
    // init ends in a spurious "could not format" warning plus prettier's own
    // stderr - which is what the filter actually buys.
    write('.prettierrc', JSON.stringify({ useTabs: true }));
    const packageJson = write('package.json');
    const binary = write('logo.bin', 'not source code');

    recordInitWrite(packageJson);
    recordInitWrite(binary);
    await formatInitWrites(repoRoot);

    expect(read('package.json')).toEqual(FORMATTED_TABS);
    expect(read('logo.bin')).toEqual('not source code');
    expect(warn).not.toHaveBeenCalled();
  });

  it('leaves files init did not write alone', async () => {
    write('.prettierrc', '{}');
    const packageJson = write('package.json');
    write('untouched.json', UNFORMATTED);

    recordInitWrite(packageJson);
    await formatInitWrites(repoRoot);

    // The whole point of recording: an existing repo's other files are not
    // init's to reformat.
    expect(read('untouched.json')).toEqual(UNFORMATTED);
  });

  it('does nothing when no formatter is configured', async () => {
    const packageJson = write('package.json');

    recordInitWrite(packageJson);
    await formatInitWrites(repoRoot);

    expect(read('package.json')).toEqual(UNFORMATTED);
  });

  it('honours NX_SKIP_FORMAT', async () => {
    process.env.NX_SKIP_FORMAT = 'true';
    write('.prettierrc', '{}');
    const packageJson = write('package.json');

    recordInitWrite(packageJson);
    await formatInitWrites(repoRoot);

    expect(read('package.json')).toEqual(UNFORMATTED);
  });

  it('does not reformat a previous run of the same process', async () => {
    write('.prettierrc', '{}');
    const packageJson = write('package.json');
    recordInitWrite(packageJson);
    await formatInitWrites(repoRoot);

    writeFileSync(packageJson, UNFORMATTED, 'utf-8');
    await formatInitWrites(repoRoot);

    expect(read('package.json')).toEqual(UNFORMATTED);
  });

  it('skips a recorded path outside the repo root', async () => {
    write('.prettierrc', '{}');
    const outside = mkdtempSync(join(tmpdir(), 'nx-init-outside-'));
    const strayPath = join(outside, 'stray.json');
    writeFileSync(strayPath, UNFORMATTED, 'utf-8');

    try {
      recordInitWrite(strayPath);
      await formatInitWrites(repoRoot);

      expect(readFileSync(strayPath, 'utf-8')).toEqual(UNFORMATTED);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });

  it('does not throw when the formatter cannot run', async () => {
    // The repo is already initialised by the time this runs, so a formatter
    // that exits non-zero must cost a warning, not the setup.
    write('.prettierrc', '{}');
    const broken = write('broken.json', '{ this is not json');

    recordInitWrite(broken);

    await expect(formatInitWrites(repoRoot)).resolves.toBeUndefined();
    expect(read('broken.json')).toEqual('{ this is not json');
    // Non-fatal must not mean silent: deleting the warn entirely would
    // otherwise leave this test green.
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Could not format'),
      })
    );
  });
});
