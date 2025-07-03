import { Tree } from '@nx/devkit';
import { createTree } from '@nx/devkit/testing';
import update from './replace-testPathPattern-with-testPathPatterns';

describe('replace-testPathPattern-with-testPathPatterns', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should replace testPathPattern with testPathPatterns using `require`', async () => {
    tree.write(
      'jest.config.ts',
      `
        module.exports = {
          testPathPattern: '**/__tests__/**/*.[jt]s?(x)',
        };
          `
    );
    await update(tree);
    const updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot();
  });

  it('should replace testPathPattern with testPathPatterns using `import`', async () => {
    tree.write(
      'jest.config.ts',
      `
        export default {
          testPathPattern: '**/__tests__/**/*.[jt]s?(x)',
        };
          `
    );
    await update(tree);
    const updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot();
  });

  it('should replace testPathPattern with testPathPatterns using `require` with `export default`', async () => {
    tree.write(
      'jest.config.ts',
      `
        export default {
          testPathPattern: '**/__tests__/**/*.[jt]s?(x)',
        };
      `
    );
    await update(tree);
    const updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot();
  });

  it('should replace testPathPattern with testPathPatterns using `import` with `module.exports`', async () => {
    tree.write(
      'jest.config.ts',
      `
        module.exports = {
          testPathPattern: '**/__tests__/**/*.[jt]s?(x)',
        };
          `
    );
    await update(tree);
    const updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot();
  });

  it('should replace testPathPattern with testPathPatterns with additional properties', async () => {
    tree.write(
      'jest.config.ts',
      `
        module.exports = {
          testPathPattern: '**/__tests__/**/*.[jt]s?(x)',
          filename: __filename,
          env: process.env,
          dirname: __dirname
        };
          `
    );
    await update(tree);
    const updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot();
  });

  it('should not update config that are not in supported format', async () => {
    // Users don't tend to update the root jest config file since it's only meant to be able to run
    // `jest` command from the root of the repo. If the AST doesn't match what we generate
    // then bail on the update. Users will still see that `getJestProjects` is deprecated when
    // viewing the file.
    tree.write(
      'jest.config.ts',
      `
        const obj = {
          testPathPattern: '**/__tests__/**/*.[jt]s?(x)',
        };
        export default obj
          `
    );
    await update(tree);
    let updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot();

    tree.write(
      'jest.config.ts',
      `
        const obj = {
          testPathPattern: '**/__tests__/**/*.[jt]s?(x)',
        };
        module.exports = obj;
          `
    );
    await update(tree);
    updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot();
  });
});
