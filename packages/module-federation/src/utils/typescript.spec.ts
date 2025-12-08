let readConfigFileResult: any;
let parseJsonConfigFileContentResult: any;
jest.mock('typescript', () => ({
  ...jest.requireActual('typescript'),
  readConfigFile: jest.fn().mockImplementation(() => readConfigFileResult),
  parseJsonConfigFileContent: jest
    .fn()
    .mockImplementation(() => parseJsonConfigFileContentResult),
}));
let mockExistsSync = jest.fn();
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: mockExistsSync,
}));

import { readTsPathMappings } from './typescript';

describe('readTsPathMappings', () => {
  afterAll(() => {
    mockExistsSync.mockRestore();
    jest.restoreAllMocks();
  });

  it('should normalize paths', () => {
    mockExistsSync.mockReturnValue(true);
    readConfigFileResult = {
      config: {
        options: {
          paths: {
            '@myorg/lib1': ['./libs/lib1/src/index.ts'],
            '@myorg/lib2': ['libs/lib2/src/index.ts'],
          },
        },
      },
    };
    parseJsonConfigFileContentResult = {
      options: {
        paths: {
          '@myorg/lib1': ['./libs/lib1/src/index.ts'],
          '@myorg/lib2': ['libs/lib2/src/index.ts'],
        },
      },
      fileNames: [],
      errors: [],
    };

    const paths = readTsPathMappings('/path/to/tsconfig.json');

    expect(paths).toEqual({
      '@myorg/lib1': ['libs/lib1/src/index.ts'],
      '@myorg/lib2': ['libs/lib2/src/index.ts'],
    });
  });
});
