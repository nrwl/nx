import { stripIndents } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { updateRemixConfig } from './update-remix-config';

describe('updateRemixConfig', () => {
  it('should add tailwind property to an existing config that doesnt have it', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      `remix.config.js`,
      stripIndents`module.exports = {
      ignoredRouteFiles: ['**/.*'],
      watchPaths: ['../../libs']
    };`
    );

    // ACT
    updateRemixConfig(tree, '.');

    // ASSERT
    expect(tree.read('remix.config.js', 'utf-8')).toMatchInlineSnapshot(`
      "module.exports = {
      tailwind: true,
      ignoredRouteFiles: ['**/.*'],
      watchPaths: ['../../libs']
      };"
    `);
  });

  it('should update tailwind property if the config has it and set to false', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      `remix.config.js`,
      stripIndents`module.exports = {
      ignoredRouteFiles: ['**/.*'],
      tailwind: false,
      watchPaths: ['../../libs']
    };`
    );

    // ACT
    updateRemixConfig(tree, '.');

    // ASSERT
    expect(tree.read('remix.config.js', 'utf-8')).toMatchInlineSnapshot(`
      "module.exports = {
      ignoredRouteFiles: ['**/.*'],
      tailwind: true,
      watchPaths: ['../../libs']
      };"
    `);
  });

  it('should not update tailwind property if the config has it and set to true', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace();
    tree.write(
      `remix.config.js`,
      stripIndents`module.exports = {
      ignoredRouteFiles: ['**/.*'],
      tailwind: true,
      watchPaths: ['../../libs']
    };`
    );

    // ACT
    updateRemixConfig(tree, '.');

    // ASSERT
    expect(tree.read('remix.config.js', 'utf-8')).toMatchInlineSnapshot(`
      "module.exports = {
      ignoredRouteFiles: ['**/.*'],
      tailwind: true,
      watchPaths: ['../../libs']
      };"
    `);
  });
});
