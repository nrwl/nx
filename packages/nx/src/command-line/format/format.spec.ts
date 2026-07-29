import { format } from './format';

// `nx format` is otherwise covered only by e2e, so the branches that decide
// whether CI passes - fail-open, configured-but-not-installed, and the
// write/check dispatch - have no fast test. These mock the seams around it.

jest.mock('../../utils/formatters', () => ({ detectFormatter: jest.fn() }));
jest.mock('../../utils/formatters/oxfmt', () => ({
  getOxfmtBinPath: jest.fn(),
  writeWithOxfmt: jest.fn(),
  checkWithOxfmt: jest.fn().mockResolvedValue([]),
}));
jest.mock('../../utils/formatters/prettier', () => ({
  getPrettierPath: jest.fn(),
  writeWithPrettier: jest.fn(),
  checkWithPrettier: jest.fn().mockResolvedValue([]),
  filterToPrettierSupportedFiles: jest.fn(async (files: string[]) => files),
  quoteForShell: jest.fn((pattern: string) => pattern),
}));
jest.mock('../../config/configuration', () => ({ readNxJson: () => ({}) }));
jest.mock('../../utils/command-line-utils', () => ({
  splitArgsIntoNxArgsAndOverrides: jest.fn(),
  parseFiles: jest.fn(() => ({ files: [] })),
  getProjectRoots: jest.fn(() => []),
}));
jest.mock('../../plugins/js/utils/typescript', () => ({
  getRootTsConfigFileName: jest.fn(() => 'tsconfig.base.json'),
  getRootTsConfigPath: jest.fn(() => '/ws/tsconfig.base.json'),
}));
jest.mock('../../utils/ignore', () => ({
  getIgnoreObject: () => ({ filter: (files: string[]) => files }),
}));
jest.mock('../../utils/fileutils', () => ({
  ...jest.requireActual('../../utils/fileutils'),
  fileExists: () => true,
}));

const { detectFormatter } = require('../../utils/formatters');
const { getOxfmtBinPath, writeWithOxfmt, checkWithOxfmt } =
  require('../../utils/formatters/oxfmt') as Record<string, jest.Mock>;
const { getPrettierPath, writeWithPrettier, checkWithPrettier } =
  require('../../utils/formatters/prettier') as Record<string, jest.Mock>;
const { splitArgsIntoNxArgsAndOverrides, parseFiles } =
  require('../../utils/command-line-utils') as Record<string, jest.Mock>;

describe('nx format', () => {
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;
  let exit: jest.SpyInstance;

  class Exited extends Error {}

  function withArgs(nxArgs: Record<string, unknown>) {
    splitArgsIntoNxArgsAndOverrides.mockReturnValue({ nxArgs });
  }

  beforeEach(() => {
    // `mockReset`, not `clearAllMocks`: the not-installed cases install a
    // throwing implementation, and clearing only wipes the call log.
    [
      getOxfmtBinPath,
      getPrettierPath,
      writeWithOxfmt,
      writeWithPrettier,
      checkWithOxfmt,
      checkWithPrettier,
      parseFiles,
      splitArgsIntoNxArgsAndOverrides,
    ].forEach((mock) => mock.mockReset());
    getOxfmtBinPath.mockReturnValue('/bin/oxfmt');
    getPrettierPath.mockReturnValue('/bin/prettier');
    parseFiles.mockReturnValue({ files: [] });

    const { output } = require('../../utils/output');
    warn = jest.spyOn(output, 'warn').mockImplementation(() => {});
    error = jest.spyOn(output, 'error').mockImplementation(() => {});
    // Throw rather than return, so the code under test stops where it would.
    exit = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Exited();
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    checkWithOxfmt.mockResolvedValue([]);
    checkWithPrettier.mockResolvedValue([]);
    withArgs({ all: true });
  });

  afterEach(() => jest.restoreAllMocks());

  it('warns and does nothing when no formatter is configured', async () => {
    // Fail-open: a Biome/dprint workspace must not be reformatted, and
    // `format:check` must not fail CI for it. Fixes #30403.
    detectFormatter.mockReturnValue(null);

    await expect(format('write', {} as any)).resolves.toBeUndefined();

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'No formatter configured.' })
    );
    expect(writeWithOxfmt).not.toHaveBeenCalled();
    expect(writeWithPrettier).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it.each([
    ['oxfmt', () => getOxfmtBinPath],
    ['prettier', () => getPrettierPath],
  ])(
    'reports an actionable error when %s is configured but not installed',
    async (formatter, resolver) => {
      // Otherwise this surfaces as a raw MODULE_NOT_FOUND from deep inside nx.
      detectFormatter.mockReturnValue(formatter);
      resolver().mockImplementation(() => {
        throw new Error('Cannot find module');
      });

      await expect(format('write', {} as any)).rejects.toThrow(Exited);

      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({
          title: `${formatter} is configured for this workspace but is not installed.`,
        })
      );
      expect(exit).toHaveBeenCalledWith(1);
    }
  );

  it.each([
    ['oxfmt', () => writeWithOxfmt],
    ['prettier', () => writeWithPrettier],
  ])('dispatches write to %s', async (formatter, writer) => {
    detectFormatter.mockReturnValue(formatter);

    await format('write', {} as any);

    expect(writer()).toHaveBeenCalledWith(['.']);
    const other = formatter === 'oxfmt' ? writeWithPrettier : writeWithOxfmt;
    expect(other).not.toHaveBeenCalled();
  });

  it('exits 1 and lists the files when check finds differences', async () => {
    detectFormatter.mockReturnValue('oxfmt');
    checkWithOxfmt.mockResolvedValue(['libs/a.ts', 'libs/b.ts']);

    await expect(format('check', {} as any)).rejects.toThrow(Exited);

    expect(console.log).toHaveBeenCalledWith('libs/a.ts\nlibs/b.ts');
    expect(exit).toHaveBeenCalledWith(1);
  });

  it('exits 0 when check finds nothing', async () => {
    detectFormatter.mockReturnValue('oxfmt');

    await expect(format('check', {} as any)).resolves.toBeUndefined();

    expect(exit).not.toHaveBeenCalled();
  });

  it('does not append root config files under --all', async () => {
    // `--all` already means "the whole tree", so re-adding nx.json would send
    // the same file twice.
    detectFormatter.mockReturnValue('oxfmt');

    await format('write', {} as any);

    expect(writeWithOxfmt).toHaveBeenCalledTimes(1);
    expect(writeWithOxfmt).toHaveBeenCalledWith(['.']);
  });

  it('appends the root config files when formatting a file subset', async () => {
    // These sit outside any project, so an affected-files run would otherwise
    // never format them.
    detectFormatter.mockReturnValue('oxfmt');
    withArgs({ all: false });
    parseFiles.mockReturnValue({ files: ['libs/a.ts'] });

    await format('write', {} as any);

    const chunks = writeWithOxfmt.mock.calls.map(([chunk]) => chunk);
    expect(chunks.flat()).toEqual(
      expect.arrayContaining(['nx.json', 'tsconfig.base.json'])
    );
  });
});
