import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { applicationGenerator } from './application';

describe('application generator', () => {
  let tree: Tree;
  const appName = 'myNodeApp';
  const appDirectory = 'my-node-app';

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace();
    jest.clearAllMocks();
  });

  it('should generate files', async () => {
    await applicationGenerator(tree, { name: appName });

    expect(tree.exists(`apps/${appDirectory}/src/main.ts`)).toBeTruthy();
    expect(
      tree.exists(`apps/${appDirectory}/src/app/app.controller.spec.ts`)
    ).toBeTruthy();
    expect(
      tree.exists(`apps/${appDirectory}/src/app/app.controller.ts`)
    ).toBeTruthy();
    expect(
      tree.exists(`apps/${appDirectory}/src/app/app.module.ts`)
    ).toBeTruthy();
    expect(
      tree.exists(`apps/${appDirectory}/src/app/app.service.spec.ts`)
    ).toBeTruthy();
    expect(
      tree.exists(`apps/${appDirectory}/src/app/app.service.ts`)
    ).toBeTruthy();
  });

  it('should configure tsconfig correctly', async () => {
    await applicationGenerator(tree, { name: appName });

    const tsConfig = devkit.readJson(
      tree,
      `apps/${appDirectory}/tsconfig.app.json`
    );
    expect(tsConfig.compilerOptions.emitDecoratorMetadata).toBe(true);
    expect(tsConfig.compilerOptions.target).toBe('es2015');
  });

  describe('--skipFormat', () => {
    it('should format files', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, { name: appName });

      expect(devkit.formatFiles).toHaveBeenCalled();
    });

    it('should not format files when --skipFormat=true', async () => {
      jest.spyOn(devkit, 'formatFiles');

      await applicationGenerator(tree, { name: appName, skipFormat: true });

      expect(devkit.formatFiles).not.toHaveBeenCalled();
    });
  });

  describe('--swc', () => {
    it('should generate swcrc file', async () => {
      await applicationGenerator(tree, { name: 'mySwcNestApp', swc: true });

      expect(tree.exists('.swcrc')).toBeTruthy();

      const workspaceJson = readJson(tree, 'workspace.json');
      const project = workspaceJson.projects['my-swc-nest-app'];
      const buildTarget = project.architect.build;
      expect(buildTarget.options.swc).toEqual(true);
    });
  });
});
