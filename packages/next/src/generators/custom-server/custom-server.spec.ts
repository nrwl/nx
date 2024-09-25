import { Tree, readJson } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from 'nx/src/devkit-testing-exports';
import { applicationGenerator } from '../application/application';

describe('app', () => {
  let tree: Tree;

  beforeAll(() => {
    tree = createTreeWithEmptyWorkspace();
  });

  it('should create a custom server', async () => {
    const name = uniq('custom-server');

    await applicationGenerator(tree, {
      directory: name,
      style: 'css',
      customServer: true,
    });

    const projectConfig = readJson(tree, `${name}/project.json`);

    expect(tree.exists(`${name}/server/main.ts`)).toBeTruthy();
    expect(tree.exists(`${name}/tsconfig.server.json`)).toBeTruthy();
    expect(projectConfig.targets['build-custom-server']).toBeTruthy();
    expect(projectConfig.targets['serve-custom-server']).toBeTruthy();
  });

  it('should create a custom server with swc', async () => {
    const name = uniq('custom-server-swc');

    await applicationGenerator(tree, {
      directory: name,
      style: 'css',
      customServer: true,
      swc: true,
    });

    const projectConfig = readJson(tree, `${name}/project.json`);
    const packageJson = readJson(tree, `package.json`);

    expect(tree.exists(`${name}/.swcrc`)).toBeTruthy();
    expect(projectConfig.targets['build-custom-server'].executor).toEqual(
      '@nx/js:swc'
    );
    expect(packageJson.devDependencies['@swc/core']).toBeTruthy();
    expect(packageJson.devDependencies['@swc/cli']).toBeTruthy();
    expect(packageJson.devDependencies['@swc-node/register']).toBeTruthy();
  });
});

function uniq(name: string) {
  return `${name}-${(Math.random() * 10000).toFixed(0)}`;
}
