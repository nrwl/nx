import type { Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  readJson,
} from '@nrwl/devkit';
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
      karma: '~6.3.0',
      'karma-chrome-launcher': '~3.1.0',
      'karma-coverage': '~2.2.0',
      'karma-jasmine': '~5.0.0',
      'karma-jasmine-html-reporter': '~1.7.0',
      'jasmine-core': '~4.1.0',
      'jasmine-spec-reporter': '~7.0.0',
      '@types/jasmine': '~4.0.0',
      '@types/node': '16.11.7',
    }
  );
}

export default karmaGenerator;
