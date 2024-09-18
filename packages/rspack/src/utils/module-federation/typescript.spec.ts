import * as fs from 'fs';
import { readTsPathMappings } from './typescript';

let readConfigFileResult: any;
let parseJsonConfigFileContentResult: any;
jest.mock('typescript', () => ({
  ...jest.requireActual('typescript'),
  readConfigFile: jest.fn().mockImplementation(() => readConfigFileResult),
  parseJsonConfigFileContent: jest
    .fn()
    .mockImplementation(() => parseJsonConfigFileContentResult),
}));

describe('readTsPathMappings', () => {
  it('should normalize paths', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
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
