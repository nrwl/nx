import { chain, mergeWith, Rule, url } from '@angular-devkit/schematics';
import { addDepsToPackageJson } from '../../utils/ast-utils';
import { jasmineMarblesVersion } from '../../lib-versions';

const updatePackageJson = addDepsToPackageJson(
  {},
  {
    karma: '~3.0.0',
    'karma-chrome-launcher': '~2.2.0',
    'karma-coverage-istanbul-reporter': '~2.0.1',
    'karma-jasmine': '~1.1.0',
    'karma-jasmine-html-reporter': '^0.2.2',
    'jasmine-core': '~2.99.1',
    'jasmine-spec-reporter': '~4.2.1',
    'jasmine-marbles': jasmineMarblesVersion,
    '@types/jasmine': '~2.8.6',
    '@types/jasminewd2': '~2.0.3'
  }
);

export default function(): Rule {
  return chain([mergeWith(url('./files')), updatePackageJson]);
}
