import type { Mock } from 'vitest';
vi.mock('fs', async () => ({
  ...(await vi.importActual<any>('fs')),
  existsSync: vi.fn((...args: any[]) =>
    (jest.requireActual('fs') as any).existsSync(...args)
  ),
}));
const fs = require('fs');

let readConfigFileResult: any;
let parseJsonConfigFileContentResult: any;
vi.mock('typescript', async () => ({
  ...(await vi.importActual<any>('typescript')),
  readConfigFile: vi.fn().mockImplementation(() => readConfigFileResult),
  parseJsonConfigFileContent: vi
    .fn()
    .mockImplementation(() => parseJsonConfigFileContentResult),
}));

import { readTsPathMappings } from './typescript';

describe('readTsPathMappings', () => {
  afterEach(() => vi.clearAllMocks());

  it('should normalize paths', () => {
    (fs.existsSync as Mock).mockReturnValue(true);
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
