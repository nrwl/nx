import { Tree } from '@nx/devkit';
import { createTree } from '@nx/devkit/testing';
import update from './replace-getJestProjects-with-getJestProjectsAsync';

describe('replace-getJestProjects-with-getJestProjectsAsync', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should replace getJestProjects with getJestProjectsAsync using `require`', async () => {
    tree.write(
      'jest.config.ts',
      `
        const { getJestProjects } = require('@nx/jest');
  
        module.exports = {
          projects: getJestProjects(),
        };
          `
    );
    await update(tree);
    const updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot(`
      "
              const { getJestProjectsAsync } = require('@nx/jest');
        
              module.exports = async () => ({
                projects: await getJestProjectsAsync(),
              });
                "
    `);
  });

  it('should replace getJestProjects with getJestProjectsAsync using `import`', async () => {
    tree.write(
      'jest.config.ts',
      `
        import { getJestProjects } from '@nx/jest';
  
        export default {
          projects: getJestProjects(),
        };
          `
    );
    await update(tree);
    const updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot(`
      "
              import { getJestProjectsAsync } from '@nx/jest';
        
              export default async () => ({
                projects: await getJestProjectsAsync(),
              });
                "
    `);
  });

  it('should replace getJestProjects with getJestProjectsAsync using `require` with `export default`', async () => {
    tree.write(
      'jest.config.ts',
      `
        const { getJestProjects } = require('@nx/jest');
  
        export default {
          projects: getJestProjects(),
        };
          `
    );
    await update(tree);
    const updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot(`
      "
              const { getJestProjectsAsync } = require('@nx/jest');
        
              export default async () => ({
                projects: await getJestProjectsAsync(),
              });
                "
    `);
  });

  it('should replace getJestProjects with getJestProjectsAsync using `import` with `module.exports`', async () => {
    tree.write(
      'jest.config.ts',
      `
        import { getJestProjects } from '@nx/jest';
  
        module.exports = {
          projects: getJestProjects(),
        };
          `
    );
    await update(tree);
    const updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot(`
      "
              import { getJestProjectsAsync } from '@nx/jest';
        
              module.exports = async () => ({
                projects: await getJestProjectsAsync(),
              });
                "
    `);
  });

  it('should replace getJestProjects with getJestProjectsAsync with additional properties', async () => {
    tree.write(
      'jest.config.ts',
      `
        const { getJestProjects } = require('@nx/jest');
  
        module.exports = {
          projects: getJestProjects(),
        filename: __filename,
        env: process.env,
        dirname: __dirname
        };
          `
    );
    await update(tree);
    const updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot(`
      "
              const { getJestProjectsAsync } = require('@nx/jest');
        
              module.exports = async () => ({
                projects: await getJestProjectsAsync(),
              filename: __filename,
              env: process.env,
              dirname: __dirname
              });
                "
    `);
  });

  it('should not update config that are not in supported format', async () => {
    // Users don't tend to update the root jest config file since it's only meant to be able to run
    // `jest` command from the root of the repo. If the AST doesn't match what we generate
    // then bail on the update. Users will still see that `getJestProjects` is deprecated when
    // viewing the file.
    tree.write(
      'jest.config.ts',
      `
        import { getJestProjects } from '@nx/jest';
  
        const obj = {
          projects: getJestProjects(),
        };
        export default obj
          `
    );
    await update(tree);
    let updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot(`
      "
              import { getJestProjects } from '@nx/jest';
        
              const obj = {
                projects: getJestProjects(),
              };
              export default obj
                "
    `);

    tree.write(
      'jest.config.ts',
      `
        const { getJestProjects } = require('@nx/jest');
  
        const obj = {
          projects: getJestProjects(),
        };
        module.exports = obj;
          `
    );
    await update(tree);
    updatedJestConfig = tree.read('jest.config.ts')?.toString();
    expect(updatedJestConfig).toMatchInlineSnapshot(`
      "
              const { getJestProjects } = require('@nx/jest');
        
              const obj = {
                projects: getJestProjects(),
              };
              module.exports = obj;
                "
    `);
  });
});
