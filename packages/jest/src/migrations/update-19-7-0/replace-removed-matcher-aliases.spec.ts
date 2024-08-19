import type { Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
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

    jest
      .spyOn(devkit, 'formatFiles')
      .mockImplementation(() => Promise.resolve());
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
      `import { describe, expect, it } from '@jest/globals';
describe('test', () => {
  it('should pass', () => {
    expect(true).toBeCalled();
    expect(true).toBeCalledTimes(1);
    expect(true).toBeCalledWith(1);
    expect(true).lastCalledWith(1);
    expect(true).nthCalledWith(1, 1);
    expect(true).toReturn();
    expect(true).toReturnTimes(1);
    expect(true).toReturnWith(1);
    expect(true).lastReturnedWith(1);
    expect(true).nthReturnedWith(1, 1);
    expect(true).toThrowError();
  });
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/app1.spec.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { describe, expect, it } from '@jest/globals';
      describe('test', () => {
        it('should pass', () => {
          expect(true).toHaveBeenCalled();
          expect(true).toHaveBeenCalledTimes(1);
          expect(true).toHaveBeenCalledWith(1);
          expect(true).toHaveBeenLastCalledWith(1);
          expect(true).toHaveBeenNthCalledWith(1, 1);
          expect(true).toHaveReturned();
          expect(true).toHaveReturnedTimes(1);
          expect(true).toHaveReturnedWith(1);
          expect(true).toHaveLastReturnedWith(1);
          expect(true).toHaveNthReturnedWith(1, 1);
          expect(true).toThrow();
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
      `import { describe, expect, it } from '@jest/globals';
import { foo } from './foo';
describe('test', () => {
  it('should pass', async () => {
    expect(true).toBeCalled();
    expect(true).not.toBeCalled();
    expect(true).toBeCalledTimes(1);
    expect(true).toBeCalledWith(1);
    expect(true).toThrowError();
    expect(true).not.toThrowError();
    await expect(foo()).rejects.toThrowError();
    await expect(foo()).resolves.not.toThrowError();
  });
});
`
    );

    await migration(tree);

    expect(tree.read('apps/app1/src/app1.spec.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { describe, expect, it } from '@jest/globals';
      import { foo } from './foo';
      describe('test', () => {
        it('should pass', async () => {
          expect(true).toHaveBeenCalled();
          expect(true).not.toHaveBeenCalled();
          expect(true).toHaveBeenCalledTimes(1);
          expect(true).toHaveBeenCalledWith(1);
          expect(true).toThrow();
          expect(true).not.toThrow();
          await expect(foo()).rejects.toThrow();
          await expect(foo()).resolves.not.toThrow();
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
      `import { describe, expect, it } from '@jest/globals';
describe('test', () => {
  it('should pass', () => {
    expect(true).toBeCalled();
    expect(true).toBeCalledTimes(1);
    expect(true).toBeCalledWith(1);
    expect(true).lastCalledWith(1);
    expect(true).nthCalledWith(1, 1);
    expect(true).toReturn();
    expect(true).toReturnTimes(1);
    expect(true).toReturnWith(1);
    expect(true).lastReturnedWith(1);
    expect(true).nthReturnedWith(1, 1);
    expect(true).toThrowError();
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
      `import { describe, expect, it } from '@jest/globals';
describe('test', () => {
  it('should pass', () => {
    expect(true).toBeCalled();
    expect(true).toBeCalledTimes(1);
    expect(true).toBeCalledWith(1);
    expect(true).lastCalledWith(1);
    expect(true).nthCalledWith(1, 1);
    expect(true).toReturn();
    expect(true).toReturnTimes(1);
    expect(true).toReturnWith(1);
    expect(true).lastReturnedWith(1);
    expect(true).nthReturnedWith(1, 1);
    expect(true).toThrowError();
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
      "import { describe, expect, it } from '@jest/globals';
      describe('test', () => {
        it('should pass', () => {
          expect(true).toHaveBeenCalled();
          expect(true).toHaveBeenCalledTimes(1);
          expect(true).toHaveBeenCalledWith(1);
          expect(true).toHaveBeenLastCalledWith(1);
          expect(true).toHaveBeenNthCalledWith(1, 1);
          expect(true).toHaveReturned();
          expect(true).toHaveReturnedTimes(1);
          expect(true).toHaveReturnedWith(1);
          expect(true).toHaveLastReturnedWith(1);
          expect(true).toHaveNthReturnedWith(1, 1);
          expect(true).toThrow();
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
