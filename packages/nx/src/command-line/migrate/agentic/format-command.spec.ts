import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { Mock } from 'vitest';
import { resetFormatterWarningsForTesting } from '../../../utils/formatters';
import { resolveFormatCommand } from './format-command';

// Detection reads the temp workspace; the bin lookup is mocked because it
// resolves against the nx repo, where both formatters are installed.
vi.mock('../../../utils/formatters/oxfmt', async () => ({
  ...(await vi.importActual('../../../utils/formatters/oxfmt')),
  getOxfmtBinPath: vi.fn(),
}));
vi.mock('../../../utils/formatters/prettier', async () => ({
  ...(await vi.importActual('../../../utils/formatters/prettier')),
  getPrettierPath: vi.fn(),
}));

const { getOxfmtBinPath } =
  (await import('../../../utils/formatters/oxfmt')) as Record<string, Mock>;
const { getPrettierPath } =
  (await import('../../../utils/formatters/prettier')) as Record<string, Mock>;

describe('resolveFormatCommand', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'nx-format-command-'));
    // The both-configured warning is warn-once module state.
    resetFormatterWarningsForTesting();
    getOxfmtBinPath.mockReset().mockReturnValue('/bin/oxfmt');
    getPrettierPath.mockReset().mockReturnValue('/bin/prettier');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns null when no formatter is configured', () => {
    expect(resolveFormatCommand(root, 'npx')).toBeNull();
  });

  it('renders the prettier command through the package manager exec prefix', () => {
    writeFileSync(join(root, '.prettierrc'), '{}');

    expect(resolveFormatCommand(root, 'pnpm exec')).toBe(
      'pnpm exec prettier --write --ignore-unknown <paths>'
    );
  });

  it('renders the oxfmt command when an oxfmt config is present', () => {
    writeFileSync(join(root, '.oxfmtrc.json'), '{}');

    expect(resolveFormatCommand(root, 'npx')).toBe(
      'npx oxfmt --no-error-on-unmatched-pattern <paths>'
    );
  });

  it('falls back to a formatter declared as a root dependency when no config exists', () => {
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({ devDependencies: { prettier: '^3.0.0' } })
    );

    expect(resolveFormatCommand(root, 'npx')).toBe(
      'npx prettier --write --ignore-unknown <paths>'
    );
  });

  // Under npm the command would make `npx` download and run the formatter.
  it.each([
    ['prettier', '.prettierrc', () => getPrettierPath],
    ['oxfmt', '.oxfmtrc.json', () => getOxfmtBinPath],
  ])(
    'returns null when %s is configured but not installed',
    (_formatter, configFile, bin) => {
      writeFileSync(join(root, configFile), '{}');
      bin().mockImplementation(() => {
        throw new Error('MODULE_NOT_FOUND');
      });

      expect(resolveFormatCommand(root, 'npx')).toBeNull();
    }
  );
});
