import { Tree } from '@nx/devkit';
import { createTree } from '@nx/devkit/testing';
import update from './replace-getJestProjects-with-getJestProjectsAsync';

describe('replace-getJestProjects-with-getJestProjectsAsync', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTree();
  });

  it('should replace getJestProjects with getJestProjectsAsync', async () => {
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
        
              export default async () => ({
                projects: await getJestProjectsAsync(),
              });
                "
    `);
  });

  it('should replace getJestProjects with getJestProjectsAsync with additonal properties', async () => {
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
        
              export default async () => ({
                projects: await getJestProjectsAsync(),
              filename: __filename,
              env: process.env,
              dirname: __dirname
              });
                "
    `);
  });
});
