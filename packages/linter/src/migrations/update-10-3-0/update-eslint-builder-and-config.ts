import { chain, Tree } from '@angular-devkit/schematics';
import {
  formatFiles,
  readJsonInTree,
  updateBuilderConfig,
} from '@nrwl/workspace';
import { join, normalize } from '@angular-devkit/core';

/**
 * When migrating projects we need to look up any relevant tsconfig files
 * to figure out what glob patterns will stand the best chance of keeping
 * the file includes behavior as consistent as possible, before and after
 * the migration.
 */
function updateESLintBuilder(host: Tree) {
  return updateBuilderConfig((options, target, project) => {
    if (options.linter === 'tslint') {
      return options;
    }
    target.builder = '@nrwl/linter:eslint';

    const tsconfigs = [];

    if (options.tsConfig) {
      const normalizedTsConfigOption = Array.isArray(options.tsConfig)
        ? options.tsConfig
        : [options.tsConfig];
      normalizedTsConfigOption.forEach((tsConfigPath) => {
        try {
          tsconfigs.push(readJsonInTree(host, tsConfigPath as string));
        } catch {}
        try {
          tsconfigs.push(readJsonInTree(host, `${project.root}/tsconfig.json`));
        } catch {}
      });
    } else {
      try {
        tsconfigs.push(readJsonInTree(host, `${project.root}/tsconfig.json`));
      } catch {}
      try {
        tsconfigs.push(
          readJsonInTree(host, `${project.root}/tsconfig.app.json`)
        );
      } catch {}
      try {
        tsconfigs.push(
          readJsonInTree(host, `${project.root}/tsconfig.lib.json`)
        );
      } catch {}
      try {
        tsconfigs.push(
          readJsonInTree(host, `${project.root}/tsconfig.spec.json`)
        );
      } catch {}
      try {
        tsconfigs.push(
          readJsonInTree(host, `${project.root}/tsconfig.e2e.json`)
        );
      } catch {}
    }

    const defaultLintFilePatterns = [`${project.root}/**/*.ts`];

    // Merge any available `includes` and `files` from the tsconfig files
    let lintFilePatterns = !tsconfigs.length
      ? defaultLintFilePatterns
      : tsconfigs
          .map((tsconfig) => {
            return [...(tsconfig.include || []), ...(tsconfig.files || [])];
          })
          .reduce((flat, val) => flat.concat(val), [])
          .map((pattern) => join(normalize(project.root), pattern))
          /**
           * Exclude any files coming from node_modules, they will be ignored by ESLint
           * and it will print a warning about it. We shouldn't be spending time linting
           * 3rd party files anyway, and if they are relevant to the TypeScript Program
           * for the linting run they will still be included in that.
           */
          .filter((pattern) => !pattern.includes('node_modules'));

    lintFilePatterns = [...new Set(lintFilePatterns)];

    return { lintFilePatterns };
  }, '@nrwl/linter:lint');
}

export default function () {
  return chain([updateESLintBuilder, formatFiles()]);
}
