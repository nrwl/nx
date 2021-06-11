import { fs, vol } from 'memfs';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { createDirectory, isRelativePath } from './fileutils';

jest.mock('fs', () => require('memfs').fs);
jest.mock('./app-root', () => ({ appRootPath: '/root' }));

describe('fileutils', () => {
  beforeEach(() => {
    vol.fromJSON(
      {
        './README.md': 'hello',
        './.nxignore': stripIndents`
          apps/demo/tmp.txt
          tmp/
        `,
        './.gitignore': stripIndents`
          *.js
          node_modules/
        `,
        './apps/demo/src/index.ts': 'console.log("hello");',
        './apps/demo/tmp.txt': '...',
        './apps/demo/tmp.js': 'console.log("tmp")',
        './workspace.json': '{}',
      },
      '/root'
    );
  });

  describe('createDirectory', () => {
    it('should recursively create the directory', () => {
      createDirectory('/root/b/c');
      expect(fs.statSync('/root').isDirectory()).toBe(true);
      expect(fs.statSync('/root/b').isDirectory()).toBe(true);
      expect(fs.statSync('/root/b/c').isDirectory()).toBe(true);
    });
  });

  describe('isRelativePath()', () => {
    it('should return true for deeper imports', () => {
      expect(isRelativePath('.')).toEqual(true);
      expect(isRelativePath('./file')).toEqual(true);
    });
    it('should return true for upper imports', () => {
      expect(isRelativePath('..')).toEqual(true);
      expect(isRelativePath('../file')).toEqual(true);
    });
    it('should return false for absolute imports', () => {
      expect(isRelativePath('file')).toEqual(false);
      expect(isRelativePath('@nrwl/angular')).toEqual(false);
    });
  });
});
