import type { Tree } from '@nx/devkit';
import * as devkit from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { applicationGenerator } from './application';

describe('application generator', () => {
  let tree: Tree;
  const appName = 'myNodeApp';
  const appDirectory = 'my-node-app';

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    jest.clearAllMocks();
  });

  it('should generate project configurations', async () => {
    await applicationGenerator(tree, { name: appName });

    const projectConfigurations = devkit.getProjects(tree);

    expect(projectConfigurations.get(appDirectory)).toBeTruthy();
    expect(projectConfigurations.get(`${appDirectory}-e2e`)).toBeTruthy();
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
    expect(tsConfig.compilerOptions.target).toBe('es2021');
    expect(tsConfig.exclude).toEqual([
      'jest.config.ts',
      'src/**/*.spec.ts',
      'src/**/*.test.ts',
    ]);
  });

  it('should add strict checks with --strict', async () => {
    await applicationGenerator(tree, { name: appName, strict: true });
    const tsConfig = devkit.readJson(
      tree,
      `apps/${appDirectory}/tsconfig.app.json`
    );

    expect(tsConfig.compilerOptions.strictNullChecks).toBeTruthy();
    expect(tsConfig.compilerOptions.noImplicitAny).toBeTruthy();
    expect(tsConfig.compilerOptions.strictBindCallApply).toBeTruthy();
    expect(
      tsConfig.compilerOptions.forceConsistentCasingInFileNames
    ).toBeTruthy();
    expect(tsConfig.compilerOptions.noFallthroughCasesInSwitch).toBeTruthy();
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

  describe('--e2e-test-runner none', () => {
    it('should not generate e2e test project', async () => {
      await applicationGenerator(tree, {
        name: appName,
        e2eTestRunner: 'none',
      });

      const projectConfigurations = devkit.getProjects(tree);

      expect(projectConfigurations.get(`${appDirectory}-e2e`)).toBeUndefined();
    });
  });
});
