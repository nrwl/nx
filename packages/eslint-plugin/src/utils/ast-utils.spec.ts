import '@nx/devkit/internal-testing-utils/mock-fs';

import { vol } from 'memfs';
import {
  getBarrelEntryPointByImportScope,
  getRelativeImportPath,
} from './ast-utils';

jest.mock('@nx/devkit', () => ({
  ...jest.requireActual<any>('@nx/devkit'),
  workspaceRoot: '/root',
}));

jest.mock('nx/src/utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));

describe('ast-utils', () => {
  beforeEach(() => {
    vol.fromJSON(
      {
        './libs/mylib/src/index.ts': 'export class MyClass {}',
      },
      '/root'
    );
  });

  describe('getRelativeImportPath', () => {
    it('should return undefined for unresolvable glob paths instead of throwing ENOENT', () => {
      expect(() =>
        getRelativeImportPath('SomeMember', '/root/libs/mylib/src/*')
      ).not.toThrow();

      const result = getRelativeImportPath(
        'SomeMember',
        '/root/libs/mylib/src/*'
      );
      expect(result).toBeUndefined();
    });

    it('should return undefined for completely nonexistent file paths', () => {
      const result = getRelativeImportPath(
        'SomeMember',
        '/root/libs/nonexistent/module'
      );
      expect(result).toBeUndefined();
    });

    it('should still resolve valid file paths normally', () => {
      // Sanity check: the function still works for real files
      const result = getRelativeImportPath(
        'MyClass',
        '/root/libs/mylib/src/index.ts'
      );
      expect(result).toBe('/root/libs/mylib/src/index.ts');
    });
  });

  describe('getBarrelEntryPointByImportScope', () => {
    it('should read paths from a root tsconfig.json when tsconfig.base.json does not exist', () => {
      vol.fromJSON(
        {
          './libs/mylib/src/index.ts': 'export class MyClass {}',
          './tsconfig.json': JSON.stringify({
            compilerOptions: {
              paths: {
                '@acme/mylib': ['libs/mylib/src/index.ts'],
              },
            },
          }),
        },
        '/root'
      );

      const result = getBarrelEntryPointByImportScope('@acme/mylib');
      expect(result).toEqual(['libs/mylib/src/index.ts']);
    });

    it('should return an empty array when neither tsconfig file exists', () => {
      const result = getBarrelEntryPointByImportScope('@acme/mylib');
      expect(result).toEqual([]);
    });
  });
});
