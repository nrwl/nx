import { Tree, noop, chain, mergeWith, url } from '@angular-devkit/schematics';
import { readJsonInTree, addDepsToPackageJson } from '@nrwl/workspace';

export default function () {
  return (host: Tree) => {
    const packageJson = readJsonInTree(host, 'package.json');
    if (packageJson.devDependencies['karma']) {
      return noop();
    }
    return chain([
      mergeWith(url('./files/karma')),
      addDepsToPackageJson(
        {},
        {
          karma: '~4.0.0',
          'karma-chrome-launcher': '~2.2.0',
          'karma-coverage-istanbul-reporter': '~2.0.1',
          'karma-jasmine': '~1.1.2',
          'karma-jasmine-html-reporter': '^0.2.2',
          'jasmine-core': '~2.99.1',
          'jasmine-spec-reporter': '~4.2.1',
          '@types/jasmine': '~2.8.8',
        }
      ),
    ]);
  };
}
