jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: jest.fn((...args: any[]) =>
    (jest.requireActual('fs') as any).existsSync(...args)
  ),
}));
const fs = require('fs');

let readConfigFileResult: any;
let parseJsonConfigFileContentResult: any;
jest.mock('typescript', () => ({
  ...jest.requireActual('typescript'),
  readConfigFile: jest.fn().mockImplementation(() => readConfigFileResult),
  parseJsonConfigFileContent: jest
    .fn()
    .mockImplementation(() => parseJsonConfigFileContentResult),
}));

import { readTsPathMappings } from './typescript';

describe('readTsPathMappings', () => {
  afterEach(() => jest.clearAllMocks());

  it('should normalize paths', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
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
