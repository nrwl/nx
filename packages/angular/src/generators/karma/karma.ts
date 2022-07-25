import type { Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  readJson,
} from '@nrwl/devkit';
import {
  jasmineCoreVersion,
  jasmineSpecReporterVersion,
  karmaChromeLauncherVersion,
  karmaCoverageVersion,
  karmaJasmineHtmlReporterVersion,
  karmaJasmineVersion,
  karmaVersion,
  typesJasmineVersion,
  typesNodeVersion,
} from '../../utils/versions';
import { GeneratorOptions } from './schema';

export function karmaGenerator(tree: Tree, options: GeneratorOptions) {
  const packageJson = readJson(tree, 'package.json');

  if (!tree.exists('karma.conf.js')) {
    generateFiles(tree, joinPathFragments(__dirname, 'files'), '.', {
      tmpl: '',
    });
  }

  if (options.skipPackageJson || packageJson.devDependencies['karma']) {
    return () => {};
  }
  return addDependenciesToPackageJson(
    tree,
    {},
    {
      karma: karmaVersion,
      'karma-chrome-launcher': karmaChromeLauncherVersion,
      'karma-coverage': karmaCoverageVersion,
      'karma-jasmine': karmaJasmineVersion,
      'karma-jasmine-html-reporter': karmaJasmineHtmlReporterVersion,
      'jasmine-core': jasmineCoreVersion,
      'jasmine-spec-reporter': jasmineSpecReporterVersion,
      '@types/jasmine': typesJasmineVersion,
      '@types/node': typesNodeVersion,
    }
  );
}

export default karmaGenerator;
