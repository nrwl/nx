import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { createApp } from '../../utils/nx-devkit/testing';
import { angularJsVersion } from '../../utils/versions';
import { upgradeModuleGenerator } from './upgrade-module';

describe('upgradeModule generator', () => {
  let tree: Tree;
  const appName = 'myapp';

  beforeEach(() => {
    jest.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    createApp(tree, appName);
  });

  it('should generate files', async () => {
    await upgradeModuleGenerator(tree, {
      name: 'legacy',
      project: appName,
      router: false,
    });

    expect(tree.exists(`/apps/${appName}/src/legacy-setup.ts`)).toBe(true);
    expect(tree.exists(`/apps/${appName}/src/hybrid.spec.ts`)).toBe(true);
  });

  it('should update module correctly', async () => {
    await upgradeModuleGenerator(tree, {
      name: 'legacy',
      project: appName,
      router: false,
    });

    expect(
      tree.read(`/apps/${appName}/src/app/app.module.ts`, 'utf-8')
    ).toMatchSnapshot();
  });

  describe('setup file', () => {
    it('should generate the setup file correctly', async () => {
      await upgradeModuleGenerator(tree, {
        name: 'legacy',
        project: appName,
        router: false,
      });

      expect(
        tree.read(`/apps/${appName}/src/legacy-setup.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should add router configuration when --router=true', async () => {
      await upgradeModuleGenerator(tree, {
        name: 'legacy',
        project: appName,
        router: true,
      });

      expect(
        tree.read(`/apps/${appName}/src/legacy-setup.ts`, 'utf-8')
      ).toMatchSnapshot();
    });

    it('should support custom angularJsImport', async () => {
      await upgradeModuleGenerator(tree, {
        name: 'legacy',
        project: appName,
        router: false,
        angularJsImport: 'legacy-app',
      });

      const legacySetup = tree.read(
        `/apps/${appName}/src/legacy-setup.ts`,
        'utf-8'
      );
      expect(legacySetup).toContain(`import 'legacy-app';`);
      expect(legacySetup).not.toContain(`import 'legacy';`);
    });

    it('should add component to upgrade when --angularJsCmpSelector is set', async () => {
      await upgradeModuleGenerator(tree, {
        name: 'legacy',
        project: appName,
        router: true,
        angularJsCmpSelector: 'legacy-cmp-selector',
      });

      expect(
        tree.read(`/apps/${appName}/src/legacy-setup.ts`, 'utf-8')
      ).toMatchSnapshot();
    });
  });

  it('should update package.json by default', async () => {
    devkit.updateJson(tree, './package.json', () => ({
      dependencies: {
        '@angular/core': '4.4.4',
      },
    }));

    await upgradeModuleGenerator(tree, {
      name: 'legacy',
      project: appName,
      router: false,
    });

    const packageJson = devkit.readJson(tree, '/package.json');
    expect(packageJson.dependencies['@angular/upgrade']).toEqual('4.4.4');
    expect(packageJson.dependencies['angular']).toBe(angularJsVersion);
  });

  it('should not update package.json when --skipPackageJson=true', async () => {
    devkit.updateJson(tree, './package.json', () => ({
      dependencies: {
        '@angular/core': '4.4.4',
      },
    }));

    await upgradeModuleGenerator(tree, {
      name: 'legacy',
      project: appName,
      skipPackageJson: true,
      router: false,
    });

    const packageJson = devkit.readJson(tree, '/package.json');
    expect(packageJson.dependencies['@angular/upgrade']).not.toBeDefined();
    expect(packageJson.dependencies['angular']).not.toBeDefined();
  });

  it('should format files', async () => {
    jest.spyOn(devkit, 'formatFiles');

    await upgradeModuleGenerator(tree, {
      name: 'legacy',
      project: appName,
      router: false,
    });

    expect(devkit.formatFiles).toHaveBeenCalled();
  });

  it('should not format files when --skipFormat=true', async () => {
    jest.spyOn(devkit, 'formatFiles');

    await upgradeModuleGenerator(tree, {
      name: 'legacy',
      project: appName,
      router: false,
      skipFormat: true,
    });

    expect(devkit.formatFiles).not.toHaveBeenCalled();
  });
});
