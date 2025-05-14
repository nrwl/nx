import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import installJiti from './install-jiti';
import { readJson } from '@nx/devkit';

describe('installJiti', () => {
  it('should add jiti to package.json', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await installJiti(tree);
    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies.jiti).toBeDefined();
    expect(packageJson.devDependencies.jiti).toMatchInlineSnapshot(`"2.4.2"`);
  });
});
