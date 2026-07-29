import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { formatInitWrites, recordInitWrite } from './format';
import { markPackageJsonAsNxProject } from './utils';

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

  const UNFORMATTED = '{"name":"x",\n    "private":   true}';
  const FORMATTED = '{\n  "name": "x",\n  "private": true\n}\n';

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), 'nx-init-format-'));
    skipFormatBackup = process.env.NX_SKIP_FORMAT;
    delete process.env.NX_SKIP_FORMAT;
  });

  afterEach(async () => {
    // Every test records something; drain it so state cannot leak between them.
    await formatInitWrites(repoRoot);
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

  it.each([
    ['prettier', '.prettierrc', '{}'],
    ['oxfmt', '.oxfmtrc.json', '{}'],
  ])('formats what init wrote with %s', async (_formatter, config, content) => {
    write(config, content);
    const packageJson = write('package.json');

    recordInitWrite(packageJson);
    await formatInitWrites(repoRoot);

    expect(read('package.json')).toEqual(FORMATTED);
  });

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
  });
});
