import { readJson, writeJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateNgccPostinstall from './update-ngcc-postinstall';

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
      const tree = createTreeWithEmptyWorkspace(2);
      tree.delete('workspace.json');
      tree.write('angular.json', '{}');
      writeJson(tree, 'package.json', {
        scripts: { postinstall: testEntry.test },
      });

      await updateNgccPostinstall(tree);

      const { scripts } = readJson(tree, 'package.json');
      expect(scripts.postinstall).toEqual(testEntry.expected);
    });
  });
});
