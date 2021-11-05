import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
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
    expect(tsConfig.exclude).toEqual(['**/*.spec.ts', '**/*.test.ts']);
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
});
