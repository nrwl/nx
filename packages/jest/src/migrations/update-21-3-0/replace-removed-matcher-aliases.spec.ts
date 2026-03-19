import { logger, type Tree } from '@nx/devkit';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import migration from './replace-removed-matcher-aliases';

describe('replace-removed-matcher-aliases migration', () => {
  let tree: Tree;
  let fs: TempFs;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    fs = new TempFs('replace-removed-matcher-aliases');
    tree.root = fs.tempDir;
  });

  it('should replace removed matcher aliases', async () => {
    writeFile(
      tree,
      'apps/app1/jest.config.js',
      `module.exports = {};
      `
    );
    writeFile(
      tree,
      'apps/app1/src/app1.spec.ts',
      `describe('test', () => {
  it('should pass', () => {
    expect(mockFn).toBeCalled();
    expect(mockFn).toBeCalledTimes(1);
    expect(mockFn).toBeCalledWith(1);
    expect(mockFn).lastCalledWith(1);
    expect(mockFn).nthCalledWith(1, 1);
    expect(mockFn).toReturn();
    expect(mockFn).toReturnTimes(1);
    expect(mockFn).toReturnWith(1);
    expect(mockFn).lastReturnedWith(1);
    expect(mockFn).nthReturnedWith(1, 1);
    expect(() => someFn()).toThrowError();
  });
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/app1.spec.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "describe('test', () => {
        it('should pass', () => {
          expect(mockFn).toHaveBeenCalled();
          expect(mockFn).toHaveBeenCalledTimes(1);
          expect(mockFn).toHaveBeenCalledWith(1);
          expect(mockFn).toHaveBeenLastCalledWith(1);
          expect(mockFn).toHaveBeenNthCalledWith(1, 1);
          expect(mockFn).toHaveReturned();
          expect(mockFn).toHaveReturnedTimes(1);
          expect(mockFn).toHaveReturnedWith(1);
          expect(mockFn).toHaveLastReturnedWith(1);
          expect(mockFn).toHaveNthReturnedWith(1, 1);
          expect(() => someFn()).toThrow();
        });
      });
      "
    `);
  });

  it('should support test files only using a few of the matcher aliases and with some variations', async () => {
    writeFile(
      tree,
      'apps/app1/jest.config.js',
      `module.exports = {};
      `
    );
    writeFile(
      tree,
      'apps/app1/src/app1.spec.ts',
      `import { foo } from './foo';
describe('test', () => {
  it('should pass', async () => {
    expect(mockFn).toBeCalled();
    expect(mockFn).not.toBeCalled();
    expect(mockFn).toBeCalledTimes(1);
    expect(mockFn).toBeCalledWith(1);
    expect(() => someFn()).toThrowError();
    expect(() => someFn()).not.toThrowError();
    await expect(someAsyncFn()).rejects.toThrowError();
    await expect(someAsyncFn()).resolves.not.toThrowError();
  });
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/app1.spec.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { foo } from './foo';
      describe('test', () => {
        it('should pass', async () => {
          expect(mockFn).toHaveBeenCalled();
          expect(mockFn).not.toHaveBeenCalled();
          expect(mockFn).toHaveBeenCalledTimes(1);
          expect(mockFn).toHaveBeenCalledWith(1);
          expect(() => someFn()).toThrow();
          expect(() => someFn()).not.toThrow();
          await expect(someAsyncFn()).rejects.toThrow();
          await expect(someAsyncFn()).resolves.not.toThrow();
        });
      });
      "
    `);
  });

  it('should not update non-jest spec files', async () => {
    writeFile(
      tree,
      'apps/app1/jest.config.js',
      `module.exports = {
        testMatch: ['**/*.spec.ts'],
      };
      `
    );
    writeFile(
      tree,
      'apps/app1/src/app1.test.ts',
      `describe('test', () => {
  it('should pass', () => {
    expect(mockFn).toBeCalled();
    expect(mockFn).toBeCalledTimes(1);
    expect(mockFn).toBeCalledWith(1);
    expect(mockFn).lastCalledWith(1);
    expect(mockFn).nthCalledWith(1, 1);
    expect(mockFn).toReturn();
    expect(mockFn).toReturnTimes(1);
    expect(mockFn).toReturnWith(1);
    expect(mockFn).lastReturnedWith(1);
    expect(mockFn).nthReturnedWith(1, 1);
    expect(() => someFn()).toThrowError();
  });
});
`
    );
    const originalTestContent = tree.read(
      'apps/app1/src/app1.test.ts',
      'utf-8'
    );
    writeFile(
      tree,
      'apps/app1/src/app1.spec.ts',
      `describe('test', () => {
  it('should pass', () => {
    expect(mockFn).toBeCalled();
    expect(mockFn).toBeCalledTimes(1);
    expect(mockFn).toBeCalledWith(1);
    expect(mockFn).lastCalledWith(1);
    expect(mockFn).nthCalledWith(1, 1);
    expect(mockFn).toReturn();
    expect(mockFn).toReturnTimes(1);
    expect(mockFn).toReturnWith(1);
    expect(mockFn).lastReturnedWith(1);
    expect(mockFn).nthReturnedWith(1, 1);
    expect(() => someFn()).toThrowError();
  });
});
`
    );

    await migration(tree);

    // verify files not matched by the testMatch pattern were not updated
    expect(tree.read('apps/app1/src/app1.test.ts', 'utf-8')).toBe(
      originalTestContent
    );
    // verify matching test files were still correctly updated
    expect(tree.read('apps/app1/src/app1.spec.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "describe('test', () => {
        it('should pass', () => {
          expect(mockFn).toHaveBeenCalled();
          expect(mockFn).toHaveBeenCalledTimes(1);
          expect(mockFn).toHaveBeenCalledWith(1);
          expect(mockFn).toHaveBeenLastCalledWith(1);
          expect(mockFn).toHaveBeenNthCalledWith(1, 1);
          expect(mockFn).toHaveReturned();
          expect(mockFn).toHaveReturnedTimes(1);
          expect(mockFn).toHaveReturnedWith(1);
          expect(mockFn).toHaveLastReturnedWith(1);
          expect(mockFn).toHaveNthReturnedWith(1, 1);
          expect(() => someFn()).toThrow();
        });
      });
      "
    `);
  });

  it('should preserve complex code patterns that could be corrupted by AST reprinting', async () => {
    // This test covers patterns that were corrupted by the old implementation which used
    // tsquery.replace() that reprints the entire AST using TypeScript's Printer.
    // The patterns include: destructuring, arrow functions, nested callbacks, and object literals.
    writeFile(
      tree,
      'apps/app1/jest.config.js',
      `module.exports = {};
      `
    );
    const complexCode = `interface Config<T> {
  buildVariables: (p: { payGroupId: string; value: T }) => unknown;
  initialValue: number;
}

const mockAutoSave = jest.fn();

function useAutoSave<T>(config: Config<T>) {
  return { autoSave: mockAutoSave, lastAttemptedValue: config.initialValue };
}

describe('useAutoSave', () => {
  beforeEach(() => {
    mockAutoSave.mockClear();
  });

  it('should handle complex callback patterns', async () => {
    const { result } = useAutoSave({
      buildVariables: ({ payGroupId, value }) => ({ payGroupId, value }),
      initialValue: 0,
    });

    expect(mockAutoSave).not.toBeCalled();

    mockAutoSave.mockImplementation(async (value: number) => {
      return { autoSave: mockAutoSave, lastAttemptedValue: value };
    });

    await result.autoSave(42);
    expect(mockAutoSave).toBeCalledWith(42);
    expect(mockAutoSave).toBeCalledTimes(1);
  });

  it('should work with nested arrow functions', () => {
    const config = {
      buildVariables: (p: { id: string }) => p,
      initialValue: 0,
    };

    const { result } = useAutoSave(config);

    expect(mockAutoSave).not.toBeCalled();
  });
});
`;

    writeFile(tree, 'apps/app1/src/useAutoSave.spec.ts', complexCode);

    await migration(tree);

    const result = tree.read('apps/app1/src/useAutoSave.spec.ts', 'utf-8');

    // Verify the output is valid TypeScript by checking key patterns weren't corrupted
    // The old buggy implementation would produce patterns like:
    // - "{buildVariables}: (p:" instead of "{ buildVariables: (p:"
    // - Missing opening braces after arrow functions
    // - Collapsed/merged code blocks
    //     expect(result).not.toContain('toBeCalled');
    expect(result).not.toContain('toBeCalledWith');
    expect(result).not.toContain('toBeCalledTimes');
    expect(result).toContain('{ payGroupId, value }');
    expect(result).toContain('{ result }');
    expect(result).not.toMatch(/\{payGroupId\}:/);
    expect(result).not.toMatch(/\{result\}:/);

    // Verify interface syntax is preserved
    expect(result).toContain('{ payGroupId: string; value: T }');
    expect(result).not.toMatch(/\{payGroupId\}: string/);

    // Snapshot test to verify the overall structure and formatting is preserved
    expect(result).toMatchInlineSnapshot(`
      "interface Config<T> {
        buildVariables: (p: { payGroupId: string; value: T }) => unknown;
        initialValue: number;
      }

      const mockAutoSave = jest.fn();

      function useAutoSave<T>(config: Config<T>) {
        return { autoSave: mockAutoSave, lastAttemptedValue: config.initialValue };
      }

      describe('useAutoSave', () => {
        beforeEach(() => {
          mockAutoSave.mockClear();
        });

        it('should handle complex callback patterns', async () => {
          const { result } = useAutoSave({
            buildVariables: ({ payGroupId, value }) => ({ payGroupId, value }),
            initialValue: 0,
          });

          expect(mockAutoSave).not.toHaveBeenCalled();

          mockAutoSave.mockImplementation(async (value: number) => {
            return { autoSave: mockAutoSave, lastAttemptedValue: value };
          });

          await result.autoSave(42);
          expect(mockAutoSave).toHaveBeenCalledWith(42);
          expect(mockAutoSave).toHaveBeenCalledTimes(1);
        });

        it('should work with nested arrow functions', () => {
          const config = {
            buildVariables: (p: { id: string }) => p,
            initialValue: 0,
          };

          const { result } = useAutoSave(config);

          expect(mockAutoSave).not.toHaveBeenCalled();
        });
      });
      "
    `);
  });

  describe('gracefully handles broken jest configs', () => {
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it('should not fail and warn when a jest config references a missing file', async () => {
      // Simulates: jest.config.ts reads a .lib.swcrc that does not exist
      writeFile(
        tree,
        'packages/broken/jest.config.ts',
        `import { readFileSync } from 'fs';
const swcConfig = JSON.parse(readFileSync(\`\${__dirname}/.lib.swcrc\`, 'utf-8'));
module.exports = { transform: { '^.+\\.[tj]s$': ['@swc/jest', swcConfig] } };`
      );

      await expect(migration(tree)).resolves.not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('packages/broken/jest.config.ts')
      );
    });

    it('should not fail and warn when a jest config references a missing preset', async () => {
      // Simulates: jest.config.ts references jest.preset.ts but only .js exists
      writeFile(
        tree,
        'packages/broken/jest.config.ts',
        `module.exports = { preset: '../../jest.preset.ts' };`
      );

      await expect(migration(tree)).resolves.not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('packages/broken/jest.config.ts')
      );
    });

    it('should not fail and warn when test path resolution throws (e.g. broken regex)', async () => {
      const { SearchSource } = require('jest');
      const spy = jest
        .spyOn(SearchSource.prototype, 'getTestPaths')
        .mockRejectedValue(new Error('Invalid regular expression'));

      writeFile(tree, 'packages/broken/jest.config.js', `module.exports = {};`);

      await expect(migration(tree)).resolves.not.toThrow();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('packages/broken/jest.config.js')
      );

      spy.mockRestore();
    });

    it('should still process valid projects when another has a broken config', async () => {
      // Broken project: references a file that does not exist
      writeFile(
        tree,
        'packages/broken/jest.config.ts',
        `import { readFileSync } from 'fs';
const swcConfig = JSON.parse(readFileSync(\`\${__dirname}/.lib.swcrc\`, 'utf-8'));
module.exports = { transform: { '^.+\\.[tj]s$': ['@swc/jest', swcConfig] } };`
      );

      // Valid project with a test file using deprecated aliases
      writeFile(tree, 'packages/valid/jest.config.js', `module.exports = {};`);
      writeFile(
        tree,
        'packages/valid/src/example.spec.ts',
        `it('test', () => { expect(fn).toBeCalled(); });`
      );

      await migration(tree);

      // Broken project was warned about
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('packages/broken/jest.config.ts')
      );

      // Valid project was still processed
      const content = tree.read('packages/valid/src/example.spec.ts', 'utf-8');
      expect(content).toContain('toHaveBeenCalled');
      expect(content).not.toContain('toBeCalled');
    });
  });

  function writeFile(tree: Tree, path: string, content: string): void {
    tree.write(path, content);
    fs.createFileSync(path, content);
  }
});
