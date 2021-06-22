import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import { createApp } from '../../utils/nx-devkit/testing';
import { angularJsVersion } from '../../utils/versions';
import { downgradeModuleGenerator } from './downgrade-module';

describe('downgradeModule generator', () => {
  let tree: Tree;
  const appName = 'myapp';

  beforeEach(() => {
    jest.clearAllMocks();
    tree = createTreeWithEmptyWorkspace();
    createApp(tree, appName);
  });

  it('should update main.ts', async () => {
    await downgradeModuleGenerator(tree, { name: 'legacy', project: appName });

    expect(
      tree.read(`/apps/${appName}/src/main.ts`, 'utf-8')
    ).toMatchSnapshot();
  });

  it('should support custom angularJsImport', async () => {
    await downgradeModuleGenerator(tree, {
      name: 'legacy',
      project: appName,
      angularJsImport: 'legacy-app',
    });

    const main = tree.read(`/apps/${appName}/src/main.ts`, 'utf-8');
    expect(main).toContain(`import 'legacy-app';`);
    expect(main).not.toContain(`import 'legacy';`);
  });

  it('should update module', async () => {
    await downgradeModuleGenerator(tree, { name: 'legacy', project: appName });

    const appModule = tree.read(
      `apps/${appName}/src/app/app.module.ts`,
      'utf-8'
    );
    expect(appModule).not.toContain('bootstrap:');
    expect(appModule).toContain('entryComponents: [AppComponent]');
    expect(appModule).toContain('ngDoBootstrap(): void {}');
  });

  it('should update package.json', async () => {
    devkit.updateJson(tree, './package.json', () => ({
      dependencies: {
        '@angular/core': '4.4.4',
      },
    }));

    await downgradeModuleGenerator(tree, { name: 'legacy', project: appName });

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

    await downgradeModuleGenerator(tree, {
      name: 'legacy',
      project: appName,
      skipPackageJson: true,
    });

    const packageJson = devkit.readJson(tree, 'package.json');
    expect(packageJson.dependencies['@angular/upgrade']).not.toBeDefined();
    expect(packageJson.dependencies['angular']).not.toBeDefined();
  });

  it('should format files', async () => {
    jest.spyOn(devkit, 'formatFiles');

    await downgradeModuleGenerator(tree, { name: 'legacy', project: appName });

    expect(devkit.formatFiles).toHaveBeenCalled();
  });

  it('should not format files when --skipFormat=true', async () => {
    jest.spyOn(devkit, 'formatFiles');

    await downgradeModuleGenerator(tree, {
      name: 'legacy',
      project: appName,
      skipFormat: true,
    });

    expect(devkit.formatFiles).not.toHaveBeenCalled();
  });
});
