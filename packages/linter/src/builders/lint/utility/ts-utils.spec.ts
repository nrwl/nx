let mockReadConfigFile = jest.fn();
const mockParseJsonConfigFileContent = jest.fn().mockReturnValue({});

jest.mock('typescript', () => ({
  sys: { readDirectory: 'sys-dir', readFile: 'sys-file' },
  DiagnosticCategory: { Error: 'diag-categ-error' },
  readConfigFile: mockReadConfigFile,
  parseJsonConfigFileContent: mockParseJsonConfigFileContent,
  formatDiagnostics: jest.fn().mockReturnValue('error details'),
  createCompilerHost: jest.fn(),
  createProgram: jest.fn(),
}));

jest.mock('path', () => ({
  dirname: jest.fn(),
  resolve: jest.fn().mockReturnValue('proj-dir'),
}));

jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('fs-read-file'),
  existsSync: () => {},
}));

const ts = require('typescript');
const { createProgram } = require('./ts-utils');

describe('ts-utility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReadConfigFile.mockReturnValue({
      config: 'read-config-file',
    });
  });
  it('should read and parse config file', () => {
    createProgram('tsconfig-1');
    expect(ts.readConfigFile).toHaveBeenCalledWith('tsconfig-1', 'sys-file');
    expect(ts.parseJsonConfigFileContent).toHaveBeenCalledWith(
      'read-config-file',
      expect.objectContaining({
        fileExists: expect.any(Function),
        readDirectory: 'sys-dir',
        readFile: expect.any(Function),
        useCaseSensitiveFileNames: true,
      }),
      'proj-dir',
      { noEmit: true }
    );
  });
  it('should throw an error if the config cannot be read', () => {
    mockReadConfigFile.mockReturnValue({ error: 'config err' });
    expect(() => createProgram('tsconfig-1')).toThrow();
    expect(ts.formatDiagnostics).toHaveBeenCalledWith(
      ['config err'],
      expect.anything()
    );
  });
  it('should throw an error if there were relevant errors while parsing', () => {
    mockParseJsonConfigFileContent.mockReturnValue({
      errors: [
        { category: 'diag-categ-error', code: 1 },
        { category: 'unexpected-category', code: 1 },
        { category: 'diag-categ-error', code: 18003 },
      ],
    });
    try {
      createProgram('tsconfig-1');
      expect(true).toBeFalsy(); //it should not get here
    } catch (e) {
      expect(ts.formatDiagnostics).toHaveBeenCalledWith(
        [{ category: 'diag-categ-error', code: 1 }],
        expect.anything()
      );
      expect(e.name).toBe('FatalError');
      expect(e.message).toEqual('error details');
    }
  });
  it('should not throw if there were no relevant errors while parsing', () => {
    mockParseJsonConfigFileContent.mockReturnValue({
      errors: [
        { category: 'diag-categ-error', code: 18003 },
        { category: 'unexpected-category', code: 1 },
        { category: 'diag-categ-error', code: 18003 },
      ],
    });
    expect(() => createProgram('tsconfig-1')).not.toThrow();
  });
});
