// Force module scoping
export default {};

jest.mock('./file-utils', () => ({
  getFilesToLint: jest.fn(),
}));

jest.mock('eslint', () => ({
  CLIEngine: jest.fn(),
}));

const { CLIEngine } = require('eslint');
(<jest.SpyInstance>CLIEngine).mockImplementation(() => ({
  executeOnFiles: (args: string[]) => args,
}));

const { lint } = require('./eslint-utils');

function prog(sourceFile: string) {
  return {
    getSourceFile: (file: string) => (sourceFile === file ? true : undefined),
  };
}

describe('eslint-util', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('should get files for linting with the correct params', async () => {
    const { getFilesToLint } = require('./file-utils');
    const lintedFiles = new Set();
    await lint(
      '/root',
      './.eslintrc.json',
      <any>{ foo: 'bar' },
      lintedFiles,
      'ts-program'
    ).catch(() => {});
    expect(getFilesToLint).toHaveBeenCalledWith(
      '/root',
      { foo: 'bar' },
      'ts-program'
    );
  });
  it('should create the CLI Engine with the proper parameters', async () => {
    const lintedFiles = new Set();
    await lint(
      '/root',
      './.eslintrc.json',
      <any>{ fix: true, cache: true, cacheLocation: '/root/cache' },
      lintedFiles,
      'ts-program'
    ).catch(() => {});
    expect(CLIEngine).toHaveBeenCalledWith({
      configFile: './.eslintrc.json',
      fix: true,
      cache: true,
      cacheLocation: '/root/cache',
      useEslintrc: true,
    });
  });
  it('should not lint the same files twice', async () => {
    const { getFilesToLint } = require('./file-utils');
    (<jest.SpyInstance>getFilesToLint).mockReturnValue([
      'file1',
      'file2',
      'file1',
      'file3',
      'file4',
    ]);
    const lintedFiles = new Set();
    lintedFiles.add('file4');
    const reports = await lint(
      '/root',
      './.eslintrc.json',
      <any>{ foo: 'bar' },
      lintedFiles
    );
    expect(reports).toEqual([['file1'], ['file2'], ['file3']]);
  });
  it('should throw an error if the file is not part of any program', async () => {
    const { getFilesToLint } = require('./file-utils');
    (<jest.SpyInstance>getFilesToLint).mockReturnValue([
      'file1',
      'file2',
      'file1',
      'file3',
    ]);
    const program = prog('file8');
    const allPrograms = [prog('file1'), prog('file2')];
    const lintedFiles = new Set();
    const lintPromise = lint(
      '/root',
      './.eslintrc.json',
      <any>{ tsConfig: 'my-ts-project' },
      lintedFiles,
      program,
      allPrograms
    );
    await expect(lintPromise).rejects.toThrow(
      `File \"file3\" is not part of a TypeScript project 'my-ts-project'.`
    );
  });
  it('should not throw an error if a file is not part of the current program but part of another', async () => {
    const { getFilesToLint } = require('./file-utils');
    (<jest.SpyInstance>getFilesToLint).mockReturnValue([
      'file1',
      'file2',
      'file1',
      'file3',
    ]);
    const program = prog('file2');
    const allPrograms = [prog('file1'), prog('file2'), prog('file3')];
    const lintedFiles = new Set();
    const lintPromise = lint(
      '/root',
      './.eslintrc.json',
      <any>{ tsConfig: 'my-ts-project' },
      lintedFiles,
      program,
      allPrograms
    );
    await expect(lintPromise).resolves.toEqual([['file2']]);
  });
});
