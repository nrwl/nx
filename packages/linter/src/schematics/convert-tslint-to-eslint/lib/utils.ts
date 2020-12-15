import { join, normalize } from '@angular-devkit/core';
import { Rule, SchematicContext, Tree } from '@angular-devkit/schematics';
import { addDepsToPackageJson } from '@nrwl/workspace';
import { allFilesInDirInHost } from '@nrwl/workspace/src/utils/ast-utils';
import * as assert from 'assert';

export function updateArrPropAndRemoveDuplication(
  json: Record<string, any>,
  configBeingExtended: Record<string, any>,
  arrPropName: string,
  deleteIfUltimatelyEmpty: boolean
): void {
  json[arrPropName] = json[arrPropName] || [];
  configBeingExtended[arrPropName] = configBeingExtended[arrPropName] || [];
  json[arrPropName] = json[arrPropName].filter(
    (extended: string) => !configBeingExtended[arrPropName].includes(extended)
  );
  json[arrPropName] = Array.from(new Set(json[arrPropName]));
  if (deleteIfUltimatelyEmpty && json[arrPropName].length === 0) {
    delete json[arrPropName];
  }
}

export function updateObjPropAndRemoveDuplication(
  json: Record<string, any>,
  configBeingExtended: Record<string, any>,
  objPropName: string,
  deleteIfUltimatelyEmpty: boolean
): void {
  json[objPropName] = json[objPropName] || {};
  configBeingExtended[objPropName] = configBeingExtended[objPropName] || {};

  for (const [name, val] of Object.entries(json[objPropName])) {
    const valueOfSamePropInExtendedConfig =
      configBeingExtended[objPropName][name];

    try {
      assert.deepStrictEqual(val, valueOfSamePropInExtendedConfig);
      delete json[objPropName][name];
    } catch {}
  }

  if (deleteIfUltimatelyEmpty && Object.keys(json[objPropName]).length === 0) {
    delete json[objPropName];
  }
}

export function ensureESLintPluginsAreInstalled(
  eslintPluginsToBeInstalled: string[]
): Rule {
  return (_host: Tree, context: SchematicContext) => {
    if (!eslintPluginsToBeInstalled?.length) {
      return;
    }

    const additionalDevDependencies = {};

    for (const pluginName of eslintPluginsToBeInstalled) {
      additionalDevDependencies[pluginName] = 'latest';
    }

    context.logger.info(
      '\nINFO: To most closely match your tslint.json, we will ensure the `latest` version of the following eslint plugin(s) are installed:'
    );
    context.logger.info('\n  - ' + eslintPluginsToBeInstalled.join('\n  - '));
    context.logger.info(
      '\nPlease note, you may later wish to pin these to a specific version number in your package.json, rather than leaving it open to `latest`.\n'
    );

    return addDepsToPackageJson({}, additionalDevDependencies);
  };
}

/**
 * Reliably inferring that something is an Angular project is not super straightforward,
 * particularly in the case of libraries, and we have to try a number of different heuristics:
 *
 * - is it configured to use a builder from @angular-devkit (other than the TSLint one itself of course)
 * - it has a karma.conf.js at the root of the project
 * - it has a jest.config.js at the root of the project which contains "jest-preset-angular"
 *
 * NOTE: we cannot do something like "contains a file ending in .module.ts", because NestJS has used so
 * many of the Angular conventions in its file naming.
 */
export function isAngularProject(tree: Tree, projectConfig: any): boolean {
  /**
   * @angular-devkit target heuristic
   */
  const targets = projectConfig.targets || projectConfig.architect;
  for (const [, targetConfig] of Object.entries(targets)) {
    const executor =
      (targetConfig as any).executor || (targetConfig as any).builder;
    if (
      executor &&
      executor.startsWith('@angular-devkit/') &&
      executor !== '@angular-devkit/build-angular:tslint'
    ) {
      return true;
    }
  }
  /**
   * Unit test configuration heuristic
   */
  if (tree.exists(join(normalize(projectConfig.root), 'karma.conf.js'))) {
    return true;
  }
  if (tree.exists(join(normalize(projectConfig.root), 'jest.config.js'))) {
    if (
      tree
        .read(join(normalize(projectConfig.root), 'jest.config.js').toString())
        .includes('jest-preset-angular')
    ) {
      return true;
    }
  }
  return false;
}

export function isE2EProject(projectName: string, projectConfig: any): boolean {
  const targets = projectConfig.targets || projectConfig.architect;
  return projectName.endsWith('-e2e') || !!targets.e2e;
}
