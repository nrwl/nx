import * as fs from 'fs';
import * as ts from 'typescript';
import { readTsPathMappings } from './typescript';

describe('readTsPathMappings', () => {
  it('should normalize paths', () => {
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(ts, 'readConfigFile').mockReturnValue({
      config: {
        options: {
          paths: {
            '@myorg/lib1': ['./libs/lib1/src/index.ts'],
            '@myorg/lib2': ['libs/lib2/src/index.ts'],
          },
        },
      },
    } as any);

    jest.spyOn(ts, 'parseJsonConfigFileContent').mockReturnValue({
      options: {
        paths: {
          '@myorg/lib1': ['./libs/lib1/src/index.ts'],
          '@myorg/lib2': ['libs/lib2/src/index.ts'],
        },
      },
      fileNames: [],
      errors: [],
    });

    const paths = readTsPathMappings('/path/to/tsconfig.json');

    expect(paths).toEqual({
      '@myorg/lib1': ['libs/lib1/src/index.ts'],
      '@myorg/lib2': ['libs/lib2/src/index.ts'],
    });
  });
});
