import { readJson } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';
import updateNgccTarget from './update-ngcc-target';

describe('update-ngcc-postinstall-target migration', () => {
  [
    {
      test: 'node ./decorate-angular-cli.js && ngcc --properties es2015 browser module main',
      expected:
        'node ./decorate-angular-cli.js && ngcc --properties es2020 browser module main',
    },
    {
      test: 'node ./decorate-angular-cli.js && ngcc --properties es2015 browser module main && echo "hi"',
      expected:
        'node ./decorate-angular-cli.js && ngcc --properties es2020 browser module main && echo "hi"',
    },
    {
      test: 'ngcc --properties es2015 browser module main && node ./decorate-angular-cli.js && echo "hi"',
      expected:
        'ngcc --properties es2020 browser module main && node ./decorate-angular-cli.js && echo "hi"',
    },
  ].forEach((testEntry) => {
    it(`should adjust ngcc target for: "${testEntry.test}"`, async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        '/package.json',
        JSON.stringify({ scripts: { postinstall: testEntry.test } })
      );

      await updateNgccTarget(tree);

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.scripts.postinstall).toEqual(testEntry.expected);
    });
  });

  [
    {
      test: 'node ngcc.js',
      expected: 'node ngcc.js',
    },
    {
      test: 'any random postinstall script',
      expected: 'any random postinstall script',
    },
  ].forEach((testEntry) => {
    it(`should not update postinstall script: "${testEntry.test}"`, async () => {
      const tree = createTreeWithEmptyWorkspace();
      tree.write(
        '/package.json',
        JSON.stringify({ scripts: { postinstall: testEntry.test } })
      );

      await updateNgccTarget(tree);

      const packageJson = readJson(tree, 'package.json');
      expect(packageJson.scripts.postinstall).toEqual(testEntry.expected);
    });
  });
});
