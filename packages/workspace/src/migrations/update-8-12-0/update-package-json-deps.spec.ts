import { Tree } from '@angular-devkit/schematics';
import { readJsonInTree } from '../../utils/ast-utils';
import { serializeJson } from '../../utilities/fileutils';
import { runMigration } from '../../utils/testing';
import { createEmptyWorkspace } from '../../utils/testing-utils';

describe('Update 8.12.0: package.json deps', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = Tree.empty();
    tree = createEmptyWorkspace(tree);
  });

  describe('Update angular devkit deps', () => {
    it('should update the Angular devkit core packages', async () => {
      tree.overwrite(
        'package.json',
        serializeJson({
          devDependencies: {
            '@angular-devkit/architect': '0.803.14',
            '@angular-devkit/build-angular': '0.803.14',
            '@angular-devkit/build-ng-packagr': '0.803.14',
            '@angular-devkit/build-optimizer': '0.803.14',
            '@angular-devkit/build-webpack': '0.803.14',
            '@angular-devkit/schematics': '8.3.14',
            '@angular/cli': '8.3.14',
          },
        })
      );

      const result = await runMigration('update-package-json-deps', {}, tree);

      const packageJson = readJsonInTree(result, 'package.json');
      expect(packageJson.devDependencies['@angular-devkit/architect']).toEqual(
        '0.803.23'
      );
      expect(
        packageJson.devDependencies['@angular-devkit/build-angular']
      ).toEqual('0.803.23');
      expect(
        packageJson.devDependencies['@angular-devkit/build-ng-packagr']
      ).toEqual('0.803.23');
      expect(
        packageJson.devDependencies['@angular-devkit/build-optimizer']
      ).toEqual('0.803.23');
      expect(
        packageJson.devDependencies['@angular-devkit/build-webpack']
      ).toEqual('0.803.23');
      expect(packageJson.devDependencies['@angular-devkit/schematics']).toEqual(
        '8.3.23'
      );
      expect(packageJson.devDependencies['@angular/cli']).toEqual('8.3.23');
    });
  });
});
