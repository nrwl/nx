import { addProjectConfiguration } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateLibraries from './update-libraries';

describe('update-libraries migration', () => {
  it('should remove enableIvy flag from tsconfig and add compilationMode', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'testing', {
      root: 'libs/testing',
      targets: {
        build: {
          executor: '@nrwl/angular:ng-packagr-lite',
          options: {},
        },
      },
    });
    tree.write(
      'libs/testing/tsconfig.lib.prod.json',
      `{
  "extends": "./tsconfig.lib.json",
  "compilerOptions": {
    "declarationMap": false
  },
  "angularCompilerOptions": {
    "enableIvy": true
  }
}`
    );

    // ACT
    updateLibraries(tree);

    // ASSERT
    const tsconfigFile = tree.read(
      'libs/testing/tsconfig.lib.prod.json',
      'utf-8'
    );
    expect(tsconfigFile.includes('enableIvy')).toBeFalsy();
    expect(tsconfigFile.includes('"compilationMode": "partial"')).toBeTruthy();
  });

  it('should remove deprecated flags from ng-pacakgr', () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'testing', {
      root: 'libs/testing',
      targets: {
        build: {
          executor: '@nrwl/angular:ng-packagr-lite',
          options: {},
        },
      },
    });
    tree.write(
      'libs/testing/ng-package.json',
      `{
        "$schema": "../../node_modules/ng-packagr/ng-package.schema.json",
        "dest": "../../dist/libs/testing",
        "lib": {
          "entryFile": "src/index.ts",
          "umdModuleIds": "ID",
          "amdId": "ID",
          "umdId": "ID"
        }
      }
      `
    );

    // ACT
    updateLibraries(tree);

    // ASSERT
    const tsconfigFile = tree.read('libs/testing/ng-package.json', 'utf-8');
    expect(tsconfigFile.includes('umdModuleIds')).toBeFalsy();
    expect(tsconfigFile.includes('amdId')).toBeFalsy();
    expect(tsconfigFile.includes('umdId')).toBeFalsy();
  });

  it("shouldn't error on null targets", async () => {
    const tree = createTreeWithEmptyWorkspace(2);
    addProjectConfiguration(tree, 'app', {
      root: 'apps/testing',
    });
    const promise = updateLibraries(tree);
    await expect(promise).resolves.not.toThrow();
  });
});
