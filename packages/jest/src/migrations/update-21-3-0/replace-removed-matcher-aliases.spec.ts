import type { Tree } from '@nx/devkit';
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

  function writeFile(tree: Tree, path: string, content: string): void {
    tree.write(path, content);
    fs.createFileSync(path, content);
  }
});
