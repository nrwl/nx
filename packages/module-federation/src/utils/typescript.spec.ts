import type { Mock } from 'vitest';
import { mockCjsModule } from '@nx/devkit/internal-testing-utils';
vi.mock('fs', async () => {
  const actual = await vi.importActual<any>('fs');
  return {
    ...actual,
    existsSync: vi.fn((...args: any[]) => actual.existsSync(...args)),
  };
});
import * as fs from 'fs';

let readConfigFileResult: any;
let parseJsonConfigFileContentResult: any;
// The source loads typescript with a lazy require(), which vi.mock cannot reach.
mockCjsModule(import.meta.url, 'typescript', {
  ...require('typescript'),
  readConfigFile: vi.fn().mockImplementation(() => readConfigFileResult),
  parseJsonConfigFileContent: vi
    .fn()
    .mockImplementation(() => parseJsonConfigFileContentResult),
});

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
