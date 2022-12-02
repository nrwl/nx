import type { Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  readJson,
  readWorkspaceConfiguration,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { versions } from '../../../utils/versions';
import { GeneratorOptions } from './schema';

function addTestInputs(tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  const productionFileSet = workspaceConfiguration.namedInputs?.production;
  if (productionFileSet) {
    productionFileSet.push(
      // Exclude spec files from production fileset
      '!{projectRoot}/**/*.spec.[jt]s',
      // Remove tsconfig.spec.json
      '!{projectRoot}/tsconfig.spec.json',
      // Remove karma.conf.js
      '!{projectRoot}/karma.conf.js'
    );
    // Dedupe and set
    workspaceConfiguration.namedInputs.production = Array.from(
      new Set(productionFileSet)
    );
  }

  // Test targets depend on all their project's sources + production sources of dependencies
  workspaceConfiguration.targetDefaults ??= {};
  workspaceConfiguration.targetDefaults.test ??= {};
  workspaceConfiguration.targetDefaults.test.inputs ??= [
    'default',
    productionFileSet ? '^production' : '^default',
  ];
  workspaceConfiguration.targetDefaults.test.inputs.push(
    '{workspaceRoot}/karma.conf.js'
  );

  updateWorkspaceConfiguration(tree, workspaceConfiguration);
}

export function karmaGenerator(tree: Tree, options: GeneratorOptions) {
  const packageJson = readJson(tree, 'package.json');

  if (!tree.exists('karma.conf.js')) {
    generateFiles(tree, joinPathFragments(__dirname, 'files'), '.', {
      tmpl: '',
    });

    addTestInputs(tree);
  }

  if (options.skipPackageJson || packageJson.devDependencies['karma']) {
    return () => {};
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    {
      karma: versions.angularV14.karmaVersion,
      'karma-chrome-launcher': versions.angularV14.karmaChromeLauncherVersion,
      'karma-coverage': versions.angularV14.karmaCoverageVersion,
      'karma-jasmine': versions.angularV14.karmaJasmineVersion,
      'karma-jasmine-html-reporter':
        versions.angularV14.karmaJasmineHtmlReporterVersion,
      'jasmine-core': versions.angularV14.jasmineCoreVersion,
      'jasmine-spec-reporter': versions.angularV14.jasmineSpecReporterVersion,
      '@types/jasmine': versions.angularV14.typesJasmineVersion,
      '@types/node': versions.angularV14.typesNodeVersion,
    }
  );
}

export default karmaGenerator;
