import { applicationGenerator as angularApplicationGenerator } from '@nrwl/angular/src/generators/application/application';
import type { Tree } from '@nrwl/devkit';
import * as devkit from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import * as semver from 'semver';
import {
  nestJsSchematicsVersion,
  nestJsVersion7,
  nestJsVersion8,
  rxjsVersion6,
  rxjsVersion7,
} from '../../utils/versions';
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

  describe('--experimentalSwc', () => {
    it('should generate swcrc file', async () => {
      await applicationGenerator(tree, {
        name: 'mySwcNestApp',
        experimentalSwc: true,
      });

      expect(tree.exists('.swcrc')).toBeTruthy();

      const workspaceJson = devkit.readJson(tree, 'workspace.json');
      const project = workspaceJson.projects['my-swc-nest-app'];
      const buildTarget = project.architect.build;
      expect(buildTarget.options.experimentalSwc).toEqual(true);
    });
  });

  describe('NestJS versions', () => {
    it('should use NestJs 8 for empty workspace', async () => {
      await applicationGenerator(tree, { name: appName });
      const pkg = devkit.readJson(tree, `package.json`);

      expect(pkg.dependencies['rxjs']).toBe(rxjsVersion7);
      expect(pkg.dependencies['@nestjs/common']).toBe(nestJsVersion8);
      expect(pkg.devDependencies['@nestjs/schematics']).toBe(
        nestJsSchematicsVersion
      );
    });

    it(`should use NestJs 8 for Angular + RxJS 7 (${rxjsVersion7}) workspace`, async () => {
      await angularApplicationGenerator(tree, { name: 'angular-app' });

      let pkg = devkit.readJson(tree, 'package.json');
      pkg.dependencies['rxjs'] = rxjsVersion7;
      tree.write('package.json', JSON.stringify(pkg));

      await applicationGenerator(tree, { name: appName });

      pkg = devkit.readJson(tree, 'package.json');

      expect(pkg.dependencies['rxjs']).toBe(rxjsVersion7);
      expect(pkg.dependencies['@nestjs/common']).toBe(nestJsVersion8);
      expect(pkg.devDependencies['@nestjs/schematics']).toBe(
        nestJsSchematicsVersion
      );
    });

    it('should use NestJs 8 for Angular + RxJS 7 (7.4.0) workspace', async () => {
      await angularApplicationGenerator(tree, { name: 'angular-app' });

      let pkg = devkit.readJson(tree, 'package.json');
      pkg.dependencies['rxjs'] = '~7.4.0';
      tree.write('package.json', JSON.stringify(pkg));

      await applicationGenerator(tree, { name: appName });

      pkg = devkit.readJson(tree, 'package.json');

      expect(pkg.dependencies['rxjs']).toBe('~7.4.0');
      expect(pkg.dependencies['@nestjs/common']).toBe(nestJsVersion8);
      expect(pkg.devDependencies['@nestjs/schematics']).toBe(
        nestJsSchematicsVersion
      );
    });

    it('should use NestJs 7 for Angular + RxJS 6 workspace', async () => {
      await angularApplicationGenerator(tree, { name: 'angular-app' });
      devkit.updateJson(tree, 'package.json', (json) => {
        json.dependencies.rxjs = rxjsVersion6;
        return json;
      });

      await applicationGenerator(tree, { name: appName });

      const pkg = devkit.readJson(tree, `package.json`);

      expect(semver.minVersion(pkg.dependencies['rxjs']).major).toBe(
        semver.minVersion(rxjsVersion6).major
      );
      expect(pkg.dependencies['@nestjs/common']).toBe(nestJsVersion7);
      expect(pkg.devDependencies['@nestjs/schematics']).toBe(
        nestJsSchematicsVersion
      );
    });
  });
});
