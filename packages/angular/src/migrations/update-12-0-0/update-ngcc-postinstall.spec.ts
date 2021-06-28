import { Tree } from '@angular-devkit/schematics';
import { createEmptyWorkspace } from '@nrwl/workspace/testing';
import { runMigration } from '../../utils/testing';

function createAngularCLIPoweredWorkspace() {
  const tree = createEmptyWorkspace(Tree.empty());
  tree.delete('workspace.json');
  tree.create('angular.json', '{}');
  return tree;
}

describe('Remove ngcc flags from postinstall script', () => {
  [
    {
      test: 'node ./decorate-angular-cli.js && ngcc --properties es2015 browser module main --first-only --create-ivy-entry-points',
      expected:
        'node ./decorate-angular-cli.js && ngcc --properties es2015 browser module main',
    },
    {
      test: 'node ./decorate-angular-cli.js && ngcc --properties es2015 browser module main --first-only --create-ivy-entry-points && echo "hi"',
      expected:
        'node ./decorate-angular-cli.js && ngcc --properties es2015 browser module main && echo "hi"',
    },
    {
      test: 'ngcc --properties es2015 browser module main --first-only --create-ivy-entry-points && node ./decorate-angular-cli.js && echo "hi"',
      expected:
        'ngcc --properties es2015 browser module main && node ./decorate-angular-cli.js && echo "hi"',
    },
    {
      test: 'ngcc --properties es2015 browser module main --first-only --create-ivy-entry-points && node ./decorate-angular-cli.js',
      expected:
        'ngcc --properties es2015 browser module main && node ./decorate-angular-cli.js',
    },
  ].forEach((testEntry) => {
    it(`should adjust ngcc for: "${testEntry.test}"`, async () => {
      const tree = createAngularCLIPoweredWorkspace();

      tree.overwrite(
        '/package.json',
        JSON.stringify({
          scripts: {
            postinstall: testEntry.test,
          },
        })
      );

      const result = await runMigration('update-ngcc-postinstall', {}, tree);

      const packageJson = JSON.parse(result.read('/package.json').toString());
      expect(packageJson.scripts.postinstall).toEqual(testEntry.expected);
    });
  });
});
