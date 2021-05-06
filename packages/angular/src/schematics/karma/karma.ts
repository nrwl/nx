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
          karma: '~5.0.0',
          'karma-chrome-launcher': '~3.1.0',
          'karma-coverage-istanbul-reporter': '~3.0.2',
          'karma-jasmine': '~4.0.0',
          'karma-jasmine-html-reporter': '^1.5.0',
          'jasmine-core': '~3.6.0',
          'jasmine-spec-reporter': '~5.0.0',
          '@types/jasmine': '~3.5.0',
        }
      ),
    ]);
  };
}
